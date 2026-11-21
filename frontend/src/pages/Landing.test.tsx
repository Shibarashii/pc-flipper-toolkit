import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "../App";
import { endSession } from "../auth";
import { EMPTY_SUMMARY } from "../test/fixtures";

beforeEach(() => {
  endSession();
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

const heading = () =>
  screen.queryByRole("heading", {
    level: 1,
    name: "See the real profit on every PC you flip",
  });

test("logged out, / is the landing page with its two ways in", () => {
  renderAt("/");
  expect(heading()).toBeTruthy();
  expect(screen.getByText("For people who flip PCs")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Try the demo" })).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Sign up" }).getAttribute("href"),
  ).toBe("/signup");
  expect(
    screen.getByText("No sign-up needed. Deleted after 24 hours."),
  ).toBeTruthy();
});

test("the picture is one labelled image that can't be clicked or focused", () => {
  renderAt("/");
  const picture = screen.getByRole("img", {
    name: "A sold build: its parts in the case, and +₱4,200.00 profit",
  });
  expect(picture.hasAttribute("inert")).toBe(true);
  // Phones and desktops each get their version; CSS shows one.
  expect(within(picture).getByText("₱9,500 bundle")).toBeTruthy();
  expect(within(picture).getAllByText("+₱4,200.00")).toHaveLength(2);
});

test("Try the demo opens the demo's builds", async () => {
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.endsWith("/auth/demo/"))
      return Response.json({ token: "abc", username: "demo-x" });
    if (url.endsWith("/builds/summary/")) return Response.json(EMPTY_SUMMARY);
    return Response.json([]);
  });
  renderAt("/");
  fireEvent.click(screen.getByRole("button", { name: "Try the demo" }));
  expect(
    await screen.findByText(
      "You’re trying a demo. It’s deleted after 24 hours.",
    ),
  ).toBeTruthy();
  expect(heading()).toBeNull();
});

test("if the demo can't start, it says so as the log-in page does", async () => {
  vi.stubGlobal("fetch", async () => {
    throw new TypeError("offline");
  });
  renderAt("/");
  fireEvent.click(screen.getByRole("button", { name: "Try the demo" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Couldn’t reach the server. Check your connection and try again.",
  );
});

test("the header has Log in on the landing page, not on Log in or Sign up", () => {
  const headerLogIn = () =>
    within(screen.getByRole("banner")).queryByRole("link", { name: "Log in" });
  renderAt("/");
  expect(headerLogIn()?.getAttribute("href")).toBe("/login");
  cleanup();
  renderAt("/login");
  expect(headerLogIn()).toBeNull();
  cleanup();
  renderAt("/signup");
  expect(headerLogIn()).toBeNull();
});

test("logged out, other pages still send you to log in", () => {
  renderAt("/builds/x");
  expect(screen.getByRole("heading", { name: "Log in" })).toBeTruthy();
});
