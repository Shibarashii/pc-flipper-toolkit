import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { getBuild } from "./api";
import App from "./App";
import { endSession, getToken, saveSession } from "./auth";
import { EMPTY_SUMMARY, makeBuild } from "./test/fixtures";

beforeEach(() => endSession());

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** Each call to fetch gets the next response (the last one repeats). The builds list's
 * summary is answered on the side, so it doesn't take a response or count as a call. */
function stubFetch(...responses: (() => Response)[]) {
  let call = 0;
  const fetchMock = vi.fn<typeof fetch>(async () =>
    responses[Math.min(call++, responses.length - 1)](),
  );
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) =>
    url.endsWith("/builds/summary/")
      ? Promise.resolve(Response.json(EMPTY_SUMMARY))
      : fetchMock(url, init),
  );
  return fetchMock;
}

const requestTo = (fetchMock: ReturnType<typeof stubFetch>, i: number) => {
  const [url, init] = fetchMock.mock.calls[i];
  return { url, headers: new Headers(init?.headers), body: init?.body };
};

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

function fillIn(username: string, password: string) {
  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: username },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
}

test("logged out, a build page sends you to log in, then back to it", async () => {
  const fetchMock = stubFetch(
    () => Response.json({ token: "abc", username: "carol" }),
    () => Response.json(makeBuild()),
  );
  renderAt("/builds/3");

  expect(screen.getByRole("heading", { name: "Log in" })).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();

  fillIn(" carol ", "a long passphrase");
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));

  expect(await screen.findByText("Ryzen 5 7600 + RTX 4060")).toBeTruthy();
  expect(screen.getByText("carol")).toBeTruthy();
  expect(requestTo(fetchMock, 0).url).toBe("/api/auth/login/");
  expect(JSON.parse(requestTo(fetchMock, 0).body as string)).toEqual({
    username: "carol",
    password: "a long passphrase",
  });
  // Later requests carry the token, merged with Content-Type where there's a body.
  expect(requestTo(fetchMock, 1).headers.get("Authorization")).toBe(
    "Token abc",
  );
  expect(JSON.parse(localStorage.getItem("session")!)).toEqual({
    token: "abc",
    username: "carol",
  });
});

test("a wrong password shows the server's message", async () => {
  stubFetch(() =>
    Response.json(
      { non_field_errors: ["Wrong username or password."] },
      { status: 400 },
    ),
  );
  renderAt("/login");

  fillIn("carol", "nope");
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Wrong username or password.",
  );
  expect(getToken()).toBe("");
});

test("sign-up errors show under their field", async () => {
  stubFetch(() =>
    Response.json(
      {
        username: ["That username is taken."],
        password: ["This password is too short."],
      },
      { status: 400 },
    ),
  );
  renderAt("/signup");

  fillIn("carol", "123");
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));

  expect(await screen.findByText("That username is taken.")).toBeTruthy();
  expect(screen.getByText("This password is too short.")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("too many attempts says to wait", async () => {
  stubFetch(() => Response.json({ detail: "Throttled" }, { status: 429 }));
  renderAt("/login");

  fillIn("carol", "nope");
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Too many attempts. Wait a minute and try again.",
  );
});

test("a 401 mid-session logs out with a message", async () => {
  saveSession({ token: "old", username: "carol" });
  stubFetch(() => Response.json({ detail: "Invalid token." }, { status: 401 }));
  renderAt("/");

  expect(
    await screen.findByText("Your session ended. Log in again."),
  ).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Log in" })).toBeTruthy();
  expect(localStorage.getItem("session")).toBeNull();
});

test("an ended demo says to try it again, not to log in", async () => {
  saveSession({ token: "d1", username: "demo-abc" });
  stubFetch(() => Response.json({ detail: "Invalid token." }, { status: 401 }));
  renderAt("/");

  expect(
    await screen.findByText("Your demo ended. Try it again or sign up."),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Try the demo" })).toBeTruthy();
});

test("Log out deletes the token on the server and goes to log in", async () => {
  saveSession({ token: "abc", username: "carol" });
  const fetchMock = stubFetch(
    () => Response.json([]),
    () => new Response(null, { status: 204 }),
  );
  renderAt("/");
  await screen.findByText("No builds yet");

  fireEvent.click(screen.getByRole("button", { name: "Log out" }));

  expect(await screen.findByRole("heading", { name: "Log in" })).toBeTruthy();
  expect(requestTo(fetchMock, 1).url).toBe("/api/auth/logout/");
  expect(requestTo(fetchMock, 1).headers.get("Authorization")).toBe(
    "Token abc",
  );
  expect(getToken()).toBe("");
});

// The page you were on belonged to the account that left, so the next one starts at home.
test.each([
  ["Exit demo", "demo-abc"],
  ["Log out", "carol"],
])(
  "%s on a build, then logging in, opens the builds list",
  async (button, username) => {
    saveSession({ token: "abc", username });
    const fetchMock = stubFetch(
      () => Response.json(makeBuild()),
      () => new Response(null, { status: 204 }),
      () => Response.json({ token: "xyz", username: "dave" }),
      () => Response.json([]),
    );
    renderAt("/builds/3");
    await screen.findByText("Ryzen 5 7600 + RTX 4060");

    fireEvent.click(screen.getByRole("button", { name: button }));
    await screen.findByRole("heading", { name: "Log in" });
    fillIn("dave", "a long passphrase");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("No builds yet")).toBeTruthy();
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("/api/builds/");
  },
);

test("an ended session on a build, then logging in, opens the builds list", async () => {
  saveSession({ token: "d1", username: "demo-abc" });
  const fetchMock = stubFetch(
    () => Response.json({ detail: "Invalid token." }, { status: 401 }),
    () => Response.json({ token: "xyz", username: "dave" }),
    () => Response.json([]),
  );
  renderAt("/builds/3");
  await screen.findByText("Your demo ended. Try it again or sign up.");

  fillIn("dave", "a long passphrase");
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));

  expect(await screen.findByText("No builds yet")).toBeTruthy();
  expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("/api/builds/");
});

test("a 401 for an older token doesn't end the current session", async () => {
  saveSession({ token: "old", username: "carol" });
  let respond: (response: Response) => void = () => {};
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>((resolve) => (respond = resolve))),
  );
  const request = getBuild("3").catch(() => {});

  // Logged out and back in (as someone else) while that request was in flight.
  saveSession({ token: "new", username: "dave" });
  respond(Response.json({ detail: "Invalid token." }, { status: 401 }));
  await request;

  expect(getToken()).toBe("new");
});

test("a 500 on log in isn't blamed on the connection", async () => {
  stubFetch(() => new Response("<h1>Server Error</h1>", { status: 500 }));
  renderAt("/login");

  fillIn("carol", "a long passphrase");
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Something went wrong. Try again.",
  );
});

test("a saved session that isn't one is ignored", async () => {
  localStorage.setItem("session", JSON.stringify({ token: 5 }));
  vi.resetModules();
  const auth = await import("./auth");

  expect(auth.getToken()).toBe("");
});

const DEMO_BANNER = /You’re trying a demo\. It’s deleted after 24 hours\./;

test("Try the demo logs into a demo account and shows the banner", async () => {
  const fetchMock = stubFetch(
    () => Response.json({ token: "d1", username: "demo-abc" }, { status: 201 }),
    () => Response.json([]),
  );
  renderAt("/signup");

  fireEvent.click(screen.getByRole("button", { name: "Try the demo" }));

  expect(await screen.findByText(DEMO_BANNER)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Exit demo" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Log out" })).toBeNull();
  expect(requestTo(fetchMock, 0).url).toBe("/api/auth/demo/");
  expect(getToken()).toBe("d1");
});

test("the banner is only for demo accounts", async () => {
  saveSession({ token: "abc", username: "carol" });
  stubFetch(() => Response.json([]));
  renderAt("/");

  await screen.findByText("No builds yet");
  expect(screen.queryByText(DEMO_BANNER)).toBeNull();
});

test("the banner's Sign up ends the demo and opens sign-up", async () => {
  saveSession({ token: "d1", username: "demo-abc" });
  const fetchMock = stubFetch(
    () => Response.json([]),
    () => new Response(null, { status: 204 }),
  );
  renderAt("/");
  await screen.findByText("No builds yet");

  fireEvent.click(
    screen.getByRole("button", { name: "Sign up for your own account" }),
  );

  expect(await screen.findByRole("heading", { name: "Sign up" })).toBeTruthy();
  expect(requestTo(fetchMock, 1).url).toBe("/api/auth/logout/");
  expect(getToken()).toBe("");
  expect(screen.queryByText(DEMO_BANNER)).toBeNull();
});

test("a failed demo shows the same messages as log-in", async () => {
  stubFetch(() => Response.json({ detail: "Throttled" }, { status: 429 }));
  renderAt("/login");

  fireEvent.click(screen.getByRole("button", { name: "Try the demo" }));

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Too many attempts. Wait a minute and try again.",
  );
});

/** Google's script, as far as the app uses it: its button hands back an ID token. */
function stubGoogle() {
  let callback: (response: { credential: string }) => void = () => {};
  const id = {
    initialize: vi.fn((options: { callback: typeof callback }) => {
      callback = options.callback;
    }),
    renderButton: vi.fn((parent: HTMLElement) => {
      const button = document.createElement("button");
      button.textContent = "Sign in with Google";
      button.onclick = () => callback({ credential: "google-id-token" });
      parent.append(button);
    }),
  };
  vi.stubGlobal("google", { accounts: { id } });
  return id;
}

test("without a Google client id there's no Google button", () => {
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
  const google = stubGoogle();
  renderAt("/login");

  expect(screen.getByRole("button", { name: "Try the demo" })).toBeTruthy();
  expect(google.renderButton).not.toHaveBeenCalled();
  expect(
    document.querySelector('script[src*="accounts.google.com"]'),
  ).toBeNull();
});

test("Sign in with Google sends Google's token and logs in", async () => {
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client.apps.googleusercontent.com");
  const google = stubGoogle();
  const fetchMock = stubFetch(
    () => Response.json({ token: "g1", username: "carol" }, { status: 201 }),
    () => Response.json([]),
  );
  renderAt("/signup");

  fireEvent.click(
    await screen.findByRole("button", { name: "Sign in with Google" }),
  );

  expect(await screen.findByRole("heading", { name: "Builds" })).toBeTruthy();
  expect(google.initialize).toHaveBeenCalledWith(
    expect.objectContaining({ client_id: "client.apps.googleusercontent.com" }),
  );
  expect(google.renderButton).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ locale: "en" }),
  );
  const { url, body } = requestTo(fetchMock, 0);
  expect(url).toBe("/api/auth/google/");
  expect(JSON.parse(body as string)).toEqual({ credential: "google-id-token" });
  expect(getToken()).toBe("g1");
});

test("a refused Google sign-in shows the server's message", async () => {
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client.apps.googleusercontent.com");
  stubGoogle();
  stubFetch(() =>
    Response.json(
      { credential: ["Google sign-in didn't work. Try again."] },
      { status: 400 },
    ),
  );
  renderAt("/login");

  fireEvent.click(
    await screen.findByRole("button", { name: "Sign in with Google" }),
  );

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Google sign-in didn't work. Try again.",
  );
  expect(getToken()).toBe("");
});
