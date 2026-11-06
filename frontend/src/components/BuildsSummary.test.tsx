import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";
import type { BuildsSummary } from "../api";
import { BuildsList } from "../pages/BuildsList";
import { makeBuild } from "../test/fixtures";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const SUMMARY: BuildsSummary = {
  this_month: { profit: "8400.00", sold: 2 },
  all_time: { profit: "41200.00", sold: 9 },
  tied_up: { cost: "23500.00", builds: 3 },
};

/** The list gets `builds`; the summary gets `summary` (a pending promise keeps it loading). */
function renderList(
  summary: Promise<Response> | (() => Response),
  builds = [makeBuild()],
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.endsWith("/builds/summary/")
        ? typeof summary === "function"
          ? summary()
          : summary
        : Response.json(builds),
    ),
  );
  render(
    <MemoryRouter>
      <BuildsList />
    </MemoryRouter>,
  );
}

const region = () => screen.findByRole("region", { name: "Builds summary" });

/** The figure under a label: its amount and the small line under it. */
function figure(summary: HTMLElement, label: string) {
  const term = within(summary).getByText(label);
  const [amount, line] = [...term.parentElement!.querySelectorAll("dd")];
  return { amount, line };
}

test("shows this month, all time and tied up from the API", async () => {
  renderList(() => Response.json(SUMMARY));

  const summary = await region();

  const month = figure(summary, "This month");
  expect(month.amount.textContent).toBe("+₱8,400.00");
  expect(month.amount.className).toContain("text-profit");
  expect(month.line.textContent).toBe("2 sold");
  const allTime = figure(summary, "All time");
  expect(allTime.amount.textContent).toBe("+₱41,200.00");
  expect(allTime.line.textContent).toBe("9 sold");
  const tiedUp = figure(summary, "Tied up");
  expect(tiedUp.amount.textContent).toBe("₱23,500.00");
  expect(tiedUp.line.textContent).toBe("in 3 builds");
});

test("a loss shows a minus in the loss colour", async () => {
  renderList(() =>
    Response.json({
      ...SUMMARY,
      this_month: { profit: "-1200.00", sold: 1 },
    }),
  );

  const month = figure(await region(), "This month");

  expect(month.amount.textContent).toBe("−₱1,200.00");
  expect(month.amount.className).toContain("text-loss");
});

test("one sale and one build are singular", async () => {
  renderList(() =>
    Response.json({
      ...SUMMARY,
      this_month: { profit: "4200.00", sold: 1 },
      tied_up: { cost: "21300.00", builds: 1 },
    }),
  );

  const summary = await region();

  expect(figure(summary, "This month").line.textContent).toBe("1 sold");
  expect(figure(summary, "Tied up").line.textContent).toBe("in 1 build");
});

test("holds its place while loading", async () => {
  renderList(new Promise(() => {}));

  await screen.findAllByText("Ryzen 5 7600 + RTX 4060");

  expect(screen.getByText("Loading summary")).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Builds summary" })).toBeNull();
});

test("with no builds there's no summary", async () => {
  renderList(() => Response.json(SUMMARY), []);

  await screen.findByText("No builds yet");

  expect(screen.queryByRole("region", { name: "Builds summary" })).toBeNull();
  expect(screen.queryByText("Loading summary")).toBeNull();
});

test("a failed summary leaves it out and the list works", async () => {
  renderList(() => new Response(null, { status: 500 }));

  await screen.findAllByText("Ryzen 5 7600 + RTX 4060");
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(screen.queryByRole("region", { name: "Builds summary" })).toBeNull();
  expect(screen.queryByText("Loading summary")).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
});
