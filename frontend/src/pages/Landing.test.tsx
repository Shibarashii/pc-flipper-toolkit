import {
  act,
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
  vi.useRealTimers();
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
    name: "Track your profit on every PC you flip",
  });

test("logged out, / is the landing page with its two ways in", () => {
  renderAt("/");
  expect(heading()).toBeTruthy();
  expect(screen.getByText("For people who flip PCs")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Try the demo" })).toHaveLength(
    2,
  );
  for (const link of screen.getAllByRole("link", { name: "Sign up" }))
    expect(link.getAttribute("href")).toBe("/signup");
  expect(
    screen.getByText(
      "No sign-up needed. Demo accounts are deleted after 24 hours.",
    ),
  ).toBeTruthy();
});

test("the picture is one labelled image that can't be clicked or focused", () => {
  renderAt("/");
  const picture = screen.getByRole("img", {
    name: "A sold build: its parts in the case, and +₱4,200.00 profit",
  });
  // Inert inside the label: an inert element is hidden from screen readers, label and all.
  expect(picture.hasAttribute("inert")).toBe(false);
  expect(picture.firstElementChild?.hasAttribute("inert")).toBe(true);
  expect(picture.children).toHaveLength(1);
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
  fireEvent.click(screen.getAllByRole("button", { name: "Try the demo" })[0]);
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
  fireEvent.click(screen.getAllByRole("button", { name: "Try the demo" })[0]);
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

test("below the hero: the blocks in order, then the closing band", () => {
  renderAt("/");
  expect(
    // The build panel's own "Build" and "Summary" are part of its picture (inert).
    screen
      .getAllByRole("heading", { level: 2 })
      .filter((h) => !h.closest("[inert]"))
      .map((h) => h.textContent),
  ).toEqual([
    "Every flip, part by part",
    "What it tracks",
    "How profit is worked out",
    "Questions",
    "Try it on two sample builds",
  ]);
  expect(
    screen.getByText(
      "Each build shows its parts, what’s still missing, and the profit as it adds up.",
    ),
  ).toBeTruthy();
  for (const [name, line] of [
    ["Parts", "Shop price and what you paid. A bundle counts once."],
    ["Extra costs", "Shipping, platform fees, thermal paste."],
    ["Status", "Planning, building, listed or sold: see where each PC is."],
  ]) {
    expect(screen.getByText(name, { selector: "h3" })).toBeTruthy();
    expect(screen.getByText(line)).toBeTruthy();
  }
  expect(
    screen.getByText("No sign-up needed. Your demo is deleted after 24 hours."),
  ).toBeTruthy();
});

test("the equation is text: sold for, minus total cost, equals profit", () => {
  renderAt("/");
  const equation = screen.getByRole("heading", {
    name: "How profit is worked out",
  }).parentElement!;
  expect(equation.textContent).toContain(
    "₱32,000Sold for−₱27,800Parts ₱27,300 + extra costs ₱500=+₱4,200Profit · 13.13% of the selling price",
  );
});

test("the questions are details rows, the first open, every answer in the page", () => {
  const { container } = renderAt("/");
  const rows = [...container.querySelectorAll("details")];
  expect(rows.map((d) => d.querySelector("summary")!.textContent)).toEqual([
    "How do I track profit when flipping PCs?",
    "Is it free?",
    "Can I try it without an account?",
    "Where do the shop prices come from?",
  ]);
  expect(rows.map((d) => d.open)).toEqual([true, false, false, false]);
  const answers = rows.map((d) => d.querySelector("p")!.textContent);
  expect(answers).toEqual([
    "Make a build for each PC, add every part with what you paid and the extra costs, then set the selling price. The app adds it up on each build and across all your builds.",
    "Yes.",
    "Yes. Try the demo gives you a demo account with two sample builds to change as you like. Demo accounts are deleted after 24 hours.",
    "When you add a part, you can search current prices from EasyPC and PC Express, refreshed once a day, or type a price yourself.",
  ]);
});

test("the build panel and the small pictures can't be clicked or focused", () => {
  const { container } = renderAt("/");
  const panel = screen.getByRole("img", {
    name: "The demo’s sold build on its build page: its parts and its summary",
  });
  expect(panel.querySelector(":scope > [inert]")).toBeTruthy();
  // The checklist's Add buttons are in the page, but inside inert.
  for (const button of within(panel).getAllByRole("button", { hidden: true }))
    expect(button.closest("[inert]")).toBeTruthy();
  // Each "What it tracks" picture is inert too; its words say what it shows.
  expect(container.querySelectorAll("li > [inert]")).toHaveLength(3);
});

test("a demo that fails in the closing band says so there", async () => {
  vi.stubGlobal("fetch", async () => {
    throw new TypeError("offline");
  });
  renderAt("/");
  const band = screen.getByRole("heading", {
    name: "Try it on two sample builds",
  }).parentElement!;
  fireEvent.click(within(band).getByRole("button", { name: "Try the demo" }));
  expect((await within(band).findByRole("alert")).textContent).toBe(
    "Couldn’t reach the server. Check your connection and try again.",
  );
  expect(screen.getAllByRole("alert")).toHaveLength(1);
});

test("the blocks below the hero fade in once, as they scroll into view", () => {
  const seen: [IntersectionObserverCallback, Element[]][] = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      targets: Element[] = [];
      constructor(callback: IntersectionObserverCallback) {
        seen.push([callback, this.targets]);
      }
      observe(el: Element) {
        this.targets.push(el);
      }
      disconnect() {}
    },
  );
  renderAt("/");
  const block = screen.getByRole("heading", {
    name: "What it tracks",
  }).parentElement!;
  const band = screen.getByRole("heading", {
    name: "Try it on two sample builds",
  }).parentElement!;
  // Hidden for the eye only: the words are in the page from the start.
  expect(block.dataset.shown).toBe("false");
  expect(band.dataset.shown).toBe("false");
  expect(block.textContent).toContain("Shipping, platform fees");

  const [callback] = seen.find(([, targets]) => targets.includes(block))!;
  act(() =>
    callback(
      [
        {
          isIntersecting: true,
          target: block,
        } as unknown as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    ),
  );
  expect(block.dataset.shown).toBe("true");
  expect(band.dataset.shown).toBe("false");
});

test("without IntersectionObserver, the blocks show at once", () => {
  vi.stubGlobal("IntersectionObserver", undefined);
  renderAt("/");
  const block = screen.getByRole("heading", {
    name: "Questions",
  }).parentElement!;
  expect(block.dataset.shown).toBe("true");
});

test("Try the demo says so at once, and the note after 5 seconds, under that copy only", () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubGlobal("fetch", () => new Promise<Response>(() => {}));
  renderAt("/");
  const band = screen.getByRole("heading", {
    name: "Try it on two sample builds",
  }).parentElement!;

  fireEvent.click(within(band).getByRole("button", { name: "Try the demo" }));

  expect(
    within(band).getByRole("button", { name: "Starting the demo…" }),
  ).toBeTruthy();
  act(() => vi.advanceTimersByTime(4900));
  expect(screen.queryByText(/Waking up the server/)).toBeNull();
  act(() => vi.advanceTimersByTime(100));
  expect(screen.getAllByText(/Waking up the server/)).toHaveLength(1);
  expect(within(band).getByText(/Waking up the server/)).toBeTruthy();
  // The hero's copy is untouched.
  expect(screen.getAllByRole("button", { name: "Try the demo" })).toHaveLength(
    1,
  );
});
