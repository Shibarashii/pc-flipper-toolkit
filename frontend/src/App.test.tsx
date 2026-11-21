import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { StrictMode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { getBuild } from "./api";
import App from "./App";
import { endSession, getToken, saveSession } from "./auth";
import { EMPTY_SUMMARY, makeBuild } from "./test/fixtures";

beforeEach(() => {
  endSession();
  // Whatever a local frontend/.env says: only the Google tests turn Google sign-in on.
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** Each call to fetch gets the next response (the last one repeats). The builds list's
 * summary is answered on the side, so it doesn't take a response or count as a call. */
function stubFetch(...responses: (() => Response | Promise<Response>)[]) {
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

const SIGNED_UP =
  "We sent a link to carol@example.com to confirm your email. If it doesn’t arrive, check your spam folder.";

test("sign-up asks for an email, then the builds list says where the link went", async () => {
  const fetchMock = stubFetch(
    () => Response.json({ token: "abc", username: "carol" }, { status: 201 }),
    () => Response.json([]),
  );
  renderAt("/signup");

  // Username, Email, Password, in that order.
  const fields = screen.getAllByRole("textbox");
  expect(fields.map((f) => f.getAttribute("autocomplete"))).toEqual([
    "username",
    "email",
  ]);
  const email = screen.getByLabelText("Email");
  expect(email.getAttribute("type")).toBe("email");
  fillIn("carol", "a long passphrase");
  const create = screen.getByRole("button", { name: "Create account" });
  expect((create as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(email, { target: { value: " carol@example.com " } });
  fireEvent.click(create);

  expect((await screen.findByRole("status")).textContent).toBe(SIGNED_UP);
  expect(screen.getByRole("heading", { name: "Builds" })).toBeTruthy();
  expect(JSON.parse(requestTo(fetchMock, 0).body as string)).toEqual({
    username: "carol",
    password: "a long passphrase",
    email: "carol@example.com",
  });
});

test("the sign-up notice shows once", async () => {
  stubFetch(
    () => Response.json({ token: "abc", username: "carol" }, { status: 201 }),
    () => Response.json([makeBuild()]),
    () => Response.json(makeBuild()),
    () => Response.json([makeBuild()]),
  );
  renderAt("/signup");
  fillIn("carol", "a long passphrase");
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "carol@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  expect(await screen.findByText(SIGNED_UP)).toBeTruthy();

  fireEvent.click((await screen.findAllByText("Ryzen 5 7600 + RTX 4060"))[0]);
  fireEvent.click(await screen.findByRole("link", { name: /All builds/ }));
  await screen.findByRole("heading", { name: "Builds" });
  expect(screen.queryByText(SIGNED_UP)).toBeNull();
});

test("a sign-up email the server refuses shows under its field", async () => {
  stubFetch(() =>
    Response.json({ email: ["Enter a valid email address."] }, { status: 400 }),
  );
  renderAt("/signup");
  fillIn("carol", "a long passphrase");
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "carol@" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  expect(await screen.findByText("Enter a valid email address.")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(getToken()).toBe("");
});

test("log-in has no email field", () => {
  stubFetch();
  renderAt("/login");
  expect(screen.queryByLabelText("Email")).toBeNull();
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
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "carol@example.com" },
  });
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
    if (button === "Exit demo")
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: button,
        }),
      );
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

test("Exit demo asks first; Cancel keeps the demo", async () => {
  saveSession({ token: "d1", username: "demo-abc" });
  const fetchMock = stubFetch(() => Response.json([]));
  renderAt("/");
  await screen.findByText(DEMO_BANNER);

  fireEvent.click(screen.getByRole("button", { name: "Exit demo" }));
  const dialog = screen.getByRole("dialog", { name: "Exit the demo?" });
  expect(dialog.textContent).toContain(
    "Its builds can’t be opened again and are deleted after 24 hours.",
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByText(DEMO_BANNER)).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
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

test("the privacy page opens from the log-in page, logged out", () => {
  const fetchMock = stubFetch();
  renderAt("/login");
  fireEvent.click(screen.getByRole("link", { name: "Privacy" }));

  expect(screen.getByRole("heading", { name: "Privacy" })).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "Deleting your account" }),
  ).toBeTruthy();
  // The footer's link says it's the page you're on.
  expect(
    screen.getByRole("link", { name: "Privacy" }).getAttribute("aria-current"),
  ).toBe("page");
  expect(screen.getByRole("link", { name: /@/ }).getAttribute("href")).toMatch(
    /^mailto:.+@.+/,
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

test("the privacy page opens logged in too", () => {
  saveSession({ token: "abc", username: "carol" });
  stubFetch();
  renderAt("/privacy");
  expect(screen.getByRole("heading", { name: "Privacy" })).toBeTruthy();
});

/** The "Change" button in one of Account's sections. */
const changeIn = async (section: string) =>
  within(await screen.findByRole("region", { name: section })).getByRole(
    "button",
    { name: "Change" },
  );

/** GET /auth/me/ for the Account page. */
const me =
  (fields: object = {}) =>
  () =>
    Response.json({
      username: "carol",
      google: null,
      has_password: true,
      is_demo: false,
      email: "",
      ...fields,
    });

/** All of an Account section's words, in order, so a test can check them word for word. */
const wordsIn = async (section: string) =>
  (await screen.findByRole("region", { name: section })).textContent;

/** Account says "log in" throughout: no "sign in" outside Google's own button, and the
 * username isn't repeated under the title. */
function expectOneVerb() {
  const words = screen
    .getByRole("main")
    .textContent.replace("Sign in with Google", "");
  expect(words).not.toMatch(/sign.?in|logged in as/i);
}

test("the username in the header opens Account, which connects Google", async () => {
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client.apps.googleusercontent.com");
  stubGoogle();
  saveSession({ token: "abc", username: "carol" });
  const fetchMock = stubFetch(
    () => Response.json([]),
    me(),
    () => Response.json({ google: { email: "c@gmail.com" } }),
  );
  renderAt("/");
  await screen.findByRole("heading", { name: "Builds" });

  fireEvent.click(screen.getAllByRole("link", { name: /carol|Account/ })[0]);
  expect(await screen.findByRole("heading", { name: "Account" })).toBeTruthy();
  await screen.findByRole("button", { name: "Sign in with Google" });
  expect(await wordsIn("Ways to log in")).toBe(
    "Ways to log inPasswordChangeGoogleNot connectedSign in with GoogleKeep at least one way to log in.",
  );
  expectOneVerb();

  fireEvent.click(screen.getByRole("button", { name: "Sign in with Google" }));
  await screen.findByText("c@gmail.com");
  expect(await wordsIn("Ways to log in")).toBe(
    "Ways to log inPasswordChangeGooglec@gmail.comDisconnectKeep at least one way to log in.",
  );
  expectOneVerb();
  const { url, body } = requestTo(fetchMock, 2);
  expect(url).toBe("/api/auth/google/connect/");
  expect(JSON.parse(body as string)).toEqual({ credential: "google-id-token" });
});

test("the header's username and Account icon both open Account", () => {
  saveSession({ token: "abc", username: "carol" });
  stubFetch(me());
  renderAt("/account");
  const links = screen.getAllByRole("link", { name: /carol|Account/ });
  expect(links.map((a) => a.getAttribute("href"))).toEqual([
    "/account",
    "/account",
  ]);
  expect(screen.getByRole("link", { name: "Account" })).toBeTruthy();
});

test("Disconnect asks first, then unlinks Google when there's a password", async () => {
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client.apps.googleusercontent.com");
  stubGoogle();
  saveSession({ token: "abc", username: "carol" });
  const fetchMock = stubFetch(
    me({ google: { email: "c@gmail.com" } }),
    () => new Response(null, { status: 204 }),
  );
  renderAt("/account");

  fireEvent.click(await screen.findByRole("button", { name: "Disconnect" }));
  const dialog = screen.getByRole("dialog", { name: "Disconnect Google?" });
  expect(dialog.textContent).toContain(
    "You’ll log in with your username and password. You can connect Google again here.",
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.click(within(dialog).getByRole("button", { name: "Disconnect" }));
  expect(await screen.findByText("Not connected")).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(
    await screen.findByRole("button", { name: "Sign in with Google" }),
  ).toBeTruthy();
  const [url, init] = fetchMock.mock.calls[1];
  expect(url).toBe("/api/auth/google/connect/");
  expect(init?.method).toBe("DELETE");
});

test("a failed Disconnect keeps the dialog open; Cancel keeps Google", async () => {
  saveSession({ token: "abc", username: "carol" });
  const fetchMock = stubFetch(me({ google: { email: "c@gmail.com" } }), () =>
    Response.json({}, { status: 500 }),
  );
  renderAt("/account");

  fireEvent.click(await screen.findByRole("button", { name: "Disconnect" }));
  const dialog = screen.getByRole("dialog", { name: "Disconnect Google?" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Disconnect" }));
  expect((await within(dialog).findByRole("alert")).textContent).toBe(
    "Couldn’t disconnect Google. Check your connection and try again.",
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByText("c@gmail.com")).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("Google's button failing to load says so, still in one verb", async () => {
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client.apps.googleusercontent.com");
  // A script that loads but won't start, as when something blocks Google.
  vi.stubGlobal("google", {
    accounts: {
      id: {
        initialize: () => {
          throw new Error("blocked");
        },
        renderButton: vi.fn(),
      },
    },
  });
  saveSession({ token: "abc", username: "carol" });
  stubFetch(me());
  renderAt("/account");

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Couldn’t load Google’s button. Check your connection and reload.",
  );
  expectOneVerb();
});

const googleOnly = (fields: object = {}) =>
  me({
    google: { email: "c@gmail.com" },
    has_password: false,
    email: "carol@example.com",
    ...fields,
  });

test("a Google-only account can set a password and keeps Google", async () => {
  saveSession({ token: "abc", username: "carol" });
  stubFetch(googleOnly());
  renderAt("/account");

  expect(await wordsIn("Ways to log in")).toBe(
    "Ways to log inPasswordNot setSet passwordGooglec@gmail.comGoogle is your only way to log in, so it stays connected.",
  );
  // Without a password there's nothing to reset, so the email only finds the username.
  expect(await wordsIn("Recovery email")).toBe(
    "Recovery emailcarol@example.comChangeUsed if you forget your username.",
  );
  expectOneVerb();
});

test("Set password emails the recovery address a link", async () => {
  saveSession({ token: "abc", username: "carol" });
  const fetchMock = stubFetch(googleOnly(), () =>
    Response.json({ detail: "sent" }, { status: 202 }),
  );
  renderAt("/account");

  fireEvent.click(await screen.findByRole("button", { name: "Set password" }));
  await screen.findByRole("status");
  expect(await wordsIn("Ways to log in")).toBe(
    "Ways to log inWe sent a link to carol@example.com. Open it within 1 hour to set your password. Not there? Check your spam folder.PasswordNot setSet passwordGooglec@gmail.comGoogle is your only way to log in, so it stays connected.",
  );
  const { url, body } = requestTo(fetchMock, 1);
  expect(url).toBe("/api/auth/password-reset/");
  expect(JSON.parse(body as string)).toEqual({ email: "carol@example.com" });
  expectOneVerb();
});

test("too many Set password tries says to wait, under the heading", async () => {
  saveSession({ token: "abc", username: "carol" });
  stubFetch(googleOnly(), () => Response.json({}, { status: 429 }));
  renderAt("/account");

  fireEvent.click(await screen.findByRole("button", { name: "Set password" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Too many attempts. Wait a minute and try again.",
  );
  expect(await wordsIn("Ways to log in")).toMatch(
    /^Ways to log inToo many attempts.*PasswordNot setSet password/,
  );
});

test("a Google-only account without a recovery email is told to add one", async () => {
  saveSession({ token: "abc", username: "carol" });
  stubFetch(googleOnly({ email: "" }));
  renderAt("/account");

  expect(await wordsIn("Ways to log in")).toBe(
    "Ways to log inPasswordNot setGooglec@gmail.comGoogle is your only way to log in, so it stays connected. Add a recovery email to set a password.",
  );
  expect(screen.queryByRole("button", { name: "Set password" })).toBeNull();
  expectOneVerb();
});

test("a demo is told to sign up first, with nothing to change", async () => {
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client.apps.googleusercontent.com");
  const google = stubGoogle();
  saveSession({ token: "d1", username: "demo-abc" });
  stubFetch(me({ username: "demo-abc", has_password: false, is_demo: true }));
  renderAt("/account");

  expect(
    await screen.findByText(
      "This is a demo account, so its settings can’t be changed. Sign up to get your own.",
    ),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Change" })).toBeNull();
  expect(screen.queryByRole("region")).toBeNull();
  expectOneVerb();
  expect(google.renderButton).not.toHaveBeenCalled();
});

test("Change renames you, and the header follows", async () => {
  saveSession({ token: "abc", username: "carol" });
  const fetchMock = stubFetch(me(), me({ username: "dave" }));
  renderAt("/account");

  fireEvent.click(await changeIn("Username"));
  const field = screen.getByRole("textbox", { name: "Username" });
  expect((field as HTMLInputElement).value).toBe("carol");
  fireEvent.change(field, { target: { value: "dave" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  expect(await screen.findByRole("link", { name: "dave" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  expect(JSON.parse(localStorage.getItem("session")!)).toEqual({
    token: "abc",
    username: "dave",
  });
  const [url, init] = fetchMock.mock.calls[1];
  expect(url).toBe("/api/auth/me/");
  expect(init?.method).toBe("PATCH");
  expect(JSON.parse(init?.body as string)).toEqual({ username: "dave" });
});

test("a rename answered after Log out doesn't log you back in", async () => {
  saveSession({ token: "abc", username: "carol" });
  let answer: (res: Response) => void = () => {};
  stubFetch(
    me(),
    () => new Promise<Response>((resolve) => (answer = resolve)),
    () => new Response(null, { status: 204 }),
  );
  renderAt("/account");

  fireEvent.click(await changeIn("Username"));
  fireEvent.change(screen.getByRole("textbox", { name: "Username" }), {
    target: { value: "dave" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  expect(await screen.findByRole("heading", { name: "Log in" })).toBeTruthy();

  answer(me({ username: "dave" })());
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(localStorage.getItem("session")).toBeNull();
  expect(screen.getByRole("heading", { name: "Log in" })).toBeTruthy();
});

test("too many renames says to wait", async () => {
  saveSession({ token: "abc", username: "carol" });
  stubFetch(me(), () => Response.json({}, { status: 429 }));
  renderAt("/account");

  fireEvent.click(await changeIn("Username"));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Too many attempts. Wait a minute and try again.",
  );
});

test("a refused username shows under the field; Cancel keeps the old one", async () => {
  saveSession({ token: "abc", username: "carol" });
  stubFetch(me(), () =>
    Response.json({ username: ["That username is taken."] }, { status: 400 }),
  );
  renderAt("/account");

  fireEvent.click(await changeIn("Username"));
  fireEvent.change(screen.getByRole("textbox", { name: "Username" }), {
    target: { value: "bob" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText("That username is taken.")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("textbox", { name: "Username" })).toBeNull();
  expect(screen.queryByText("That username is taken.")).toBeNull();
  expect(screen.getByRole("link", { name: "carol" })).toBeTruthy();
});

test("a refused connect shows the server's message", async () => {
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client.apps.googleusercontent.com");
  stubGoogle();
  saveSession({ token: "abc", username: "carol" });
  stubFetch(me(), () =>
    Response.json(
      {
        non_field_errors: [
          "This Google account is connected to another account.",
        ],
      },
      { status: 400 },
    ),
  );
  renderAt("/account");

  fireEvent.click(
    await screen.findByRole("button", { name: "Sign in with Google" }),
  );
  expect((await screen.findByRole("alert")).textContent).toBe(
    "This Google account is connected to another account.",
  );
  expect(screen.getByText("Not connected")).toBeTruthy();
});

test("Change password keeps this browser logged in with a new token", async () => {
  saveSession({ token: "abc", username: "carol" });
  const fetchMock = stubFetch(me(), () =>
    Response.json({ token: "new", username: "carol" }),
  );
  renderAt("/account");

  fireEvent.click(await changeIn("Ways to log in"));
  // Password managers update the saved login named by the (hidden) username field.
  expect(screen.getByDisplayValue("carol").getAttribute("autocomplete")).toBe(
    "username",
  );
  for (const [label, autocomplete] of [
    ["Current password", "current-password"],
    ["New password", "new-password"],
  ])
    expect(screen.getByLabelText(label).getAttribute("autocomplete")).toBe(
      autocomplete,
    );
  fireEvent.change(screen.getByLabelText("Current password"), {
    target: { value: "old passphrase" },
  });
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: "new passphrase" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Change password" }));

  expect((await screen.findByRole("status")).textContent).toBe(
    "Password changed. You’re logged out on your other devices.",
  );
  expectOneVerb();
  expect(screen.queryByLabelText("New password")).toBeNull();
  expect(getToken()).toBe("new");
  const { url, body } = requestTo(fetchMock, 1);
  expect(url).toBe("/api/auth/password/");
  expect(JSON.parse(body as string)).toEqual({
    current_password: "old passphrase",
    new_password: "new passphrase",
  });
});

test("a wrong current password shows under its field", async () => {
  saveSession({ token: "abc", username: "carol" });
  stubFetch(me(), () =>
    Response.json(
      { current_password: ["That isn’t your current password."] },
      { status: 400 },
    ),
  );
  renderAt("/account");

  fireEvent.click(await changeIn("Ways to log in"));
  for (const label of ["Current password", "New password"])
    fireEvent.change(screen.getByLabelText(label), {
      target: { value: "a passphrase" },
    });
  fireEvent.click(screen.getByRole("button", { name: "Change password" }));
  expect(
    await screen.findByText("That isn’t your current password."),
  ).toBeTruthy();
  expect(getToken()).toBe("abc");
});

test("too many password attempts says to wait", async () => {
  saveSession({ token: "abc", username: "carol" });
  stubFetch(me(), () => Response.json({}, { status: 429 }));
  renderAt("/account");

  fireEvent.click(await changeIn("Ways to log in"));
  for (const label of ["Current password", "New password"])
    fireEvent.change(screen.getByLabelText(label), {
      target: { value: "a passphrase" },
    });
  fireEvent.click(screen.getByRole("button", { name: "Change password" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Too many attempts. Wait a minute and try again.",
  );
  expect(getToken()).toBe("abc");
});

test("a session changed in another tab is followed here", () => {
  saveSession({ token: "abc", username: "carol" });
  // What another tab's password change (or Log out) leaves in storage.
  localStorage.setItem(
    "session",
    JSON.stringify({ token: "new", username: "carol" }),
  );
  window.dispatchEvent(new StorageEvent("storage", { key: "session" }));
  expect(getToken()).toBe("new");

  localStorage.removeItem("session");
  window.dispatchEvent(new StorageEvent("storage", { key: "session" }));
  expect(getToken()).toBe("");
});

test("another tab clearing storage logs this one out too", () => {
  saveSession({ token: "abc", username: "carol" });
  localStorage.clear();
  window.dispatchEvent(new StorageEvent("storage", { key: null }));
  expect(getToken()).toBe("");
});

test("Account says so when it can't load", async () => {
  saveSession({ token: "abc", username: "carol" });
  stubFetch(() => Response.json({}, { status: 500 }));
  renderAt("/account");
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Couldn’t load your account",
  );
});

test("an account without an email adds one, and sees the link was sent", async () => {
  saveSession({ token: "abc", username: "carol" });
  const fetchMock = stubFetch(me({ email: "" }), () =>
    Response.json(null, { status: 202 }),
  );
  renderAt("/account");

  const email = await screen.findByRole("region", { name: "Recovery email" });
  expect(await wordsIn("Recovery email")).toBe(
    "Recovery emailNo recovery email yet.Used if you forget your username or password.Add email",
  );
  expectOneVerb();
  fireEvent.click(within(email).getByRole("button", { name: "Add email" }));
  const field = within(email).getByRole("textbox", { name: "Email" });
  expect(field.getAttribute("type")).toBe("email");
  expect(field.getAttribute("autocomplete")).toBe("email");
  fireEvent.change(field, { target: { value: "carol@example.com" } });
  fireEvent.click(within(email).getByRole("button", { name: "Send link" }));

  expect((await within(email).findByRole("status")).textContent).toBe(
    "We sent a link to carol@example.com. Open it within 24 hours to confirm. Not there? Check your spam folder.",
  );
  expectOneVerb();
  // Nothing is saved until the link is opened, so the form just closes.
  expect(within(email).queryByRole("textbox")).toBeNull();
  const { url, body } = requestTo(fetchMock, 1);
  expect(url).toBe("/api/auth/email/");
  expect(JSON.parse(body as string)).toEqual({ email: "carol@example.com" });
});

test("an account with an email shows it, and Change starts from it", async () => {
  saveSession({ token: "abc", username: "carol" });
  stubFetch(me({ email: "carol@example.com" }));
  renderAt("/account");

  const email = await screen.findByRole("region", { name: "Recovery email" });
  expect(await wordsIn("Recovery email")).toBe(
    "Recovery emailcarol@example.comChangeUsed if you forget your username or password.",
  );
  expectOneVerb();
  fireEvent.click(await changeIn("Recovery email"));
  const field = within(email).getByRole("textbox", { name: "Email" });
  expect((field as HTMLInputElement).value).toBe("carol@example.com");
  fireEvent.click(within(email).getByRole("button", { name: "Cancel" }));
  expect(within(email).getByText("carol@example.com")).toBeTruthy();
});

test("another account's email shows under the field", async () => {
  saveSession({ token: "abc", username: "carol" });
  stubFetch(me({ email: "" }), () =>
    Response.json(
      { email: ["That email is used by another account."] },
      { status: 400 },
    ),
  );
  renderAt("/account");

  fireEvent.click(await screen.findByRole("button", { name: "Add email" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
    target: { value: "dave@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send link" }));
  expect(
    await screen.findByText("That email is used by another account."),
  ).toBeTruthy();
  expect(screen.queryByRole("status")).toBeNull();
});

test("too many links says to wait", async () => {
  saveSession({ token: "abc", username: "carol" });
  stubFetch(me({ email: "" }), () => Response.json({}, { status: 429 }));
  renderAt("/account");

  fireEvent.click(await screen.findByRole("button", { name: "Add email" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
    target: { value: "carol@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send link" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Too many attempts. Wait a minute and try again.",
  );
});

test.each([
  ["logged out", false],
  ["logged in", true],
])("a confirmation link confirms the email, %s", async (_, loggedIn) => {
  if (loggedIn) saveSession({ token: "abc", username: "carol" });
  const fetchMock = stubFetch(() =>
    Response.json({ email: "carol@example.com" }),
  );
  renderAt("/verify-email?token=signed.token");

  expect(
    await screen.findByRole("heading", { name: "Email confirmed" }),
  ).toBeTruthy();
  expect(screen.getByText(/is on your account now\./).textContent).toBe(
    "carol@example.com is on your account now.",
  );
  expect(
    screen.getByRole("link", { name: "Go to Account" }).getAttribute("href"),
  ).toBe("/account");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const { url, body } = requestTo(fetchMock, 0);
  expect(url).toBe("/api/auth/email/confirm/");
  expect(JSON.parse(body as string)).toEqual({ token: "signed.token" });
});

test("StrictMode's second effect doesn't use the link up", async () => {
  const fetchMock = stubFetch(() =>
    Response.json({ email: "carol@example.com" }),
  );
  render(
    <StrictMode>
      <MemoryRouter initialEntries={["/verify-email?token=once"]}>
        <App />
      </MemoryRouter>
    </StrictMode>,
  );
  expect(
    await screen.findByRole("heading", { name: "Email confirmed" }),
  ).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("logging out on the page keeps what the link said", async () => {
  saveSession({ token: "abc", username: "carol" });
  const fetchMock = stubFetch(
    () => Response.json({ email: "carol@example.com" }),
    () => new Response(null, { status: 204 }),
  );
  renderAt("/verify-email?token=then-log-out");
  await screen.findByRole("heading", { name: "Email confirmed" });

  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Log out" })).toBeNull(),
  );
  // Same page, not a new one: the link isn't sent again.
  expect(screen.getByRole("heading", { name: "Email confirmed" })).toBeTruthy();
  const confirms = fetchMock.mock.calls.filter(([url]) =>
    String(url).endsWith("/email/confirm/"),
  );
  expect(confirms).toHaveLength(1);
});

test("a used, expired or broken link explains itself", async () => {
  stubFetch(() =>
    Response.json({ token: ["This link no longer works."] }, { status: 400 }),
  );
  renderAt("/verify-email?token=used");

  expect(
    await screen.findByRole("heading", { name: "This link no longer works" }),
  ).toBeTruthy();
  expect(
    screen.getByText(
      "Confirmation links work once, for 24 hours. Add your email again on Account to get a new one.",
    ),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Go to Account" }).getAttribute("href"),
  ).toBe("/account");
});

test("a link without a token doesn't ask the server", async () => {
  const fetchMock = stubFetch();
  renderAt("/verify-email");
  expect(
    await screen.findByRole("heading", { name: "This link no longer works" }),
  ).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("an email another account took meanwhile says so", async () => {
  stubFetch(() =>
    Response.json(
      { email: ["That email is used by another account."] },
      { status: 400 },
    ),
  );
  renderAt("/verify-email?token=late");
  expect(
    await screen.findByRole("heading", { name: "Couldn’t confirm your email" }),
  ).toBeTruthy();
  expect(
    screen.getByText("That email is used by another account."),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: "Go to Account" })).toBeTruthy();
});

// Forgot your username or password (docs/specs/account-management.md, part 3).
test("log-in links to forgot, sign-up doesn't", async () => {
  renderAt("/login");
  expect(
    screen
      .getByRole("link", { name: "Forgot your username or password?" })
      .getAttribute("href"),
  ).toBe("/forgot");
  fireEvent.click(screen.getByRole("link", { name: "Sign up" }));
  await screen.findByRole("heading", { name: "Sign up" });
  expect(
    screen.queryByRole("link", { name: "Forgot your username or password?" }),
  ).toBeNull();
});

const SENT_DETAIL = "If an account has that email, we've sent it a link.";

function askForLink(email: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send link" }));
}

test.each([
  ["logged out", false],
  ["logged in", true],
])("forgot sends a link and says the same thing, %s", async (_, loggedIn) => {
  if (loggedIn) saveSession({ token: "abc", username: "carol" });
  const fetchMock = stubFetch(() =>
    Response.json({ detail: SENT_DETAIL }, { status: 202 }),
  );
  renderAt("/forgot");
  expect(
    screen.getByRole("heading", { name: "Forgot your username or password?" }),
  ).toBeTruthy();
  expect(
    screen.getByText(
      "Type your account’s email. We’ll send your username and a link to set a new password.",
    ),
  ).toBeTruthy();

  askForLink(" carol@example.com ");
  const sent = await screen.findByRole("status");
  expect(sent.textContent).toBe(
    "If an account has that email, we’ve sent it a link. It works for 1 hour. If it doesn’t arrive, check your spam folder.",
  );
  expect(document.activeElement).toBe(sent); // the form it replaced had focus
  expect(screen.queryByRole("textbox", { name: "Email" })).toBeNull();
  expect(
    screen.getByRole("link", { name: "Back to log in" }).getAttribute("href"),
  ).toBe("/login");
  const { url, body } = requestTo(fetchMock, 0);
  expect(url).toBe("/api/auth/password-reset/");
  expect(JSON.parse(body as string)).toEqual({ email: "carol@example.com" });
});

test("forgot shows what's wrong with the email, or too many tries", async () => {
  stubFetch(
    () =>
      Response.json(
        { email: ["Enter a valid email address."] },
        { status: 400 },
      ),
    () => Response.json({}, { status: 429 }),
  );
  renderAt("/forgot");

  askForLink("carol");
  expect(await screen.findByText("Enter a valid email address.")).toBeTruthy();
  askForLink("carol@example.com");
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Too many attempts. Wait a minute and try again.",
  );
  expect(screen.queryByRole("status")).toBeNull();
});

function setNewPassword(password: string) {
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: "Set password" }));
}

test.each([
  ["logged out", false],
  ["logged in", true],
])("a reset link sets a new password, %s", async (_, loggedIn) => {
  if (loggedIn) saveSession({ token: "abc", username: "carol" });
  const fetchMock = stubFetch(() => new Response(null, { status: 204 }));
  renderAt("/reset-password?uid=MQ&token=set-abc");
  expect(
    screen.getByRole("heading", { name: "Set a new password" }),
  ).toBeTruthy();

  setNewPassword("a new passphrase");
  const heading = await screen.findByRole("heading", {
    name: "Password changed",
  });
  expect(document.activeElement).toBe(heading);
  expect(screen.getByText("Log in with your new password.")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Log in" }).getAttribute("href"),
  ).toBe("/login");
  const { url, body } = requestTo(fetchMock, 0);
  expect(url).toBe("/api/auth/password-reset/confirm/");
  expect(JSON.parse(body as string)).toEqual({
    uid: "MQ",
    token: "set-abc",
    new_password: "a new passphrase",
  });
});

test("a used, expired or changed reset link offers a new one", async () => {
  stubFetch(() =>
    Response.json({ token: ["This link no longer works."] }, { status: 400 }),
  );
  renderAt("/reset-password?uid=MQ&token=used");
  setNewPassword("a new passphrase");

  const heading = await screen.findByRole("heading", {
    name: "This link no longer works",
  });
  expect(document.activeElement).toBe(heading);
  expect(
    screen.getByText("Reset links work once, for 1 hour. Ask for a new one."),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Get a new link" }).getAttribute("href"),
  ).toBe("/forgot");
});

test("a reset link without its uid or token doesn't ask the server", async () => {
  const fetchMock = stubFetch();
  renderAt("/reset-password?token=abc");
  expect(
    await screen.findByRole("heading", { name: "This link no longer works" }),
  ).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("a weak new password says why and keeps the form", async () => {
  stubFetch(
    () =>
      Response.json(
        { new_password: ["This password is too common."] },
        { status: 400 },
      ),
    () => Response.json({}, { status: 500 }),
  );
  renderAt("/reset-password?uid=MQ&token=abc");

  setNewPassword("password");
  expect(await screen.findByText("This password is too common.")).toBeTruthy();
  expect(
    screen.getByLabelText("New password").getAttribute("aria-invalid"),
  ).toBe("true");
  setNewPassword("a new passphrase");
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Something went wrong. Try again.",
  );
  expect(
    screen.getByRole("heading", { name: "Set a new password" }),
  ).toBeTruthy();
});

const REPO = "https://github.com/Shibarashii/pc-flipper-toolkit";
const LINKEDIN = "https://www.linkedin.com/in/seanrei-valdeabella/";

function expectFooter() {
  const footer = within(screen.getByRole("contentinfo"));
  expect(footer.getByText("© 2026 Seanrei Valdeabella")).toBeTruthy();
  expect(
    footer.getByRole("link", { name: "Privacy" }).getAttribute("href"),
  ).toBe("/privacy");
  // GitHub's and LinkedIn's logos, named for screen readers, with no word on screen.
  for (const [name, href] of [
    ["GitHub", REPO],
    ["LinkedIn", LINKEDIN],
  ]) {
    // They leave the app, so they open in a new tab, and say so.
    const icon = footer.getByRole("link", {
      name: `${name} (opens in a new tab)`,
    });
    expect(icon.getAttribute("href")).toBe(href);
    expect(icon.getAttribute("target")).toBe("_blank");
    expect(icon.getAttribute("rel")).toBe("noreferrer");
    expect(icon.textContent).toBe("");
    expect(icon.querySelector("svg")).toBeTruthy();
  }
}

test("the header's home link is the logo, then the name, in one link", () => {
  stubFetch();
  renderAt("/login");
  const home = screen.getByRole("link", { name: "PC Flipper Toolkit" });
  expect(home.getAttribute("href")).toBe("/");
  // One logo per theme; index.css shows the one in the theme's green.
  const [light, dark, name] = home.children;
  expect(light.getAttribute("src")).toBe("/logo-light.png");
  expect(light.getAttribute("class")).toContain("logo-light");
  expect(dark.getAttribute("src")).toBe("/logo-dark.png");
  expect(dark.getAttribute("class")).toContain("logo-dark");
  for (const logo of [light, dark]) expect(logo.getAttribute("alt")).toBe("");
  expect(name.textContent).toBe("PC Flipper Toolkit");
});

test("logged out, the footer has the © line, Privacy, GitHub and LinkedIn", () => {
  stubFetch();
  renderAt("/login");
  expectFooter();
  // The footer's is the log-in page's only Privacy link.
  expect(screen.getAllByRole("link", { name: "Privacy" })).toHaveLength(1);
});

test("logged in, the footer is there too, so Privacy is reachable", async () => {
  saveSession({ token: "abc", username: "carol" });
  stubFetch(() => Response.json([]));
  renderAt("/");
  await screen.findByRole("heading", { name: "Builds" });
  expectFooter();
});

test("the header's username shows in full on hover, since it can be cut off", async () => {
  saveSession({ token: "abc", username: "a-rather-long-username" });
  stubFetch(
    () => Response.json([]),
    () => Response.json(EMPTY_SUMMARY),
  );
  renderAt("/");
  await screen.findByRole("heading", { name: "Builds" });

  const link = screen.getByRole("link", { name: "a-rather-long-username" });
  expect(link.title).toBe("a-rather-long-username");
});
