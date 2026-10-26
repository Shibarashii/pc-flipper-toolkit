import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";
import { EMPTY_TOTALS, makeBuild, SPEC_TOTALS } from "../test/fixtures";
import { BuildsList } from "./BuildsList";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("each build shows its total cost, selling price and signed profit", async () => {
  const builds = [
    makeBuild({
      id: 1,
      name: "Profit",
      selling_price: "50000.00",
      totals: SPEC_TOTALS,
    }),
    makeBuild({
      id: 2,
      name: "Loss",
      selling_price: "43500.00",
      totals: { ...SPEC_TOTALS, total_cost: "44800.00", profit: "-1300.00" },
    }),
    makeBuild({
      id: 3,
      name: "Unpriced",
      totals: { ...EMPTY_TOTALS, total_cost: "9200.00" },
    }),
  ];
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(builds)));
  render(
    <MemoryRouter>
      <BuildsList />
    </MemoryRouter>,
  );

  // Every value appears twice: in the desktop table and the mobile card.
  await screen.findAllByText("Profit");
  expect(screen.getAllByText("₱46,300.00")).toHaveLength(2);
  expect(screen.getAllByText("+₱3,700.00")[0].className).toContain(
    "text-profit",
  );
  expect(screen.getAllByText("−₱1,300.00")[0].className).toContain("text-loss");
  expect(screen.getAllByText("₱9,200.00")).toHaveLength(2);
  // The unpriced build: "—" for both selling price and profit, in table and card.
  expect(screen.getAllByText("—")).toHaveLength(4);
});
