// Each page names itself in the tab and in search results (docs/specs/landing-page.md).
import { cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "./App";
import { endSession, saveSession } from "./auth";
import { SITE_URL } from "./site";
import { EMPTY_SUMMARY, makeBuild } from "./test/fixtures";

beforeEach(() => {
  endSession();
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.endsWith("/builds/summary/")) return Response.json(EMPTY_SUMMARY);
    if (url.endsWith("/builds/")) return Response.json([]);
    if (url.includes("/builds/")) return Response.json(makeBuild());
    if (url.endsWith("/auth/me/"))
      return Response.json({
        username: "carol",
        google: null,
        has_password: true,
        is_demo: false,
        email: "",
      });
    return new Response(null, { status: 400 });
  });
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

const canonicals = () =>
  [...document.querySelectorAll("link[rel=canonical]")].map((l) =>
    l.getAttribute("href"),
  );

test.each([
  ["/", "PC Flipper Toolkit · Track the profit on every PC you flip"],
  ["/login", "Log in · PC Flipper Toolkit"],
  ["/signup", "Sign up · PC Flipper Toolkit"],
  ["/privacy", "Privacy · PC Flipper Toolkit"],
  ["/forgot", "Forgot password · PC Flipper Toolkit"],
  ["/reset-password", "Reset password · PC Flipper Toolkit"],
  ["/verify-email", "Verify email · PC Flipper Toolkit"],
])("logged out, %s is titled %s", async (path, title) => {
  renderAt(path);
  await waitFor(() => expect(document.title).toBe(title));
});

test.each([
  ["/", "Builds · PC Flipper Toolkit"],
  ["/account", "Account · PC Flipper Toolkit"],
  ["/builds/3", "Ryzen 5 7600 + RTX 4060 · PC Flipper Toolkit"],
])("logged in, %s is titled %s", async (path, title) => {
  saveSession({ token: "abc", username: "carol" });
  renderAt(path);
  await waitFor(() => expect(document.title).toBe(title));
});

test("only the landing page and Privacy name their own address as canonical", async () => {
  renderAt("/");
  await waitFor(() => expect(canonicals()).toEqual([`${SITE_URL}/`]));
  cleanup();
  renderAt("/privacy");
  await waitFor(() => expect(canonicals()).toEqual([`${SITE_URL}/privacy`]));
  cleanup();
  renderAt("/login");
  await waitFor(() => expect(document.title).toMatch(/^Log in/));
  expect(canonicals()).toEqual([]);
});

test("a build that doesn't exist is titled like its heading", async () => {
  saveSession({ token: "abc", username: "carol" });
  vi.stubGlobal("fetch", async () =>
    Response.json({ detail: "Not found." }, { status: 404 }),
  );
  renderAt("/builds/3");
  await waitFor(() =>
    expect(document.title).toBe("Build not found · PC Flipper Toolkit"),
  );
});
