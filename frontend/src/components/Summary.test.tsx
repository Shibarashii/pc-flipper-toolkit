import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { EMPTY_TOTALS, SPEC_TOTALS } from "../test/fixtures";
import { Summary } from "./Summary";

afterEach(cleanup);

/** The value cell next to a label, e.g. row("Total cost") → "₱46,300.00". */
const row = (label: string) =>
  within(screen.getByText(label).parentElement!).getAllByRole("definition")[0]
    .textContent;

test("renders every total from the server", () => {
  render(<Summary totals={SPEC_TOTALS} sellingPrice="50000.00" />);

  expect(screen.getByText("+₱3,700.00").className).toContain("text-profit");
  expect(screen.getByText("7.40% margin")).toBeTruthy();
  expect(row("Listed total")).toBe("₱52,000.00");
  expect(row("Parts cost")).toBe("₱45,500.00");
  expect(row("Extra costs")).toBe("₱800.00");
  expect(row("Total cost")).toBe("₱46,300.00");
  expect(row("Selling price")).toBe("₱50,000.00");
  expect(row("Below market")).toBe("₱2,000.00 · 3.85%");
  expect(row("Voucher savings")).toBe("₱6,500.00");
});

test("null totals show a dash and a prompt to set a price", () => {
  render(<Summary totals={EMPTY_TOTALS} sellingPrice={null} />);

  expect(screen.getByText("Set a selling price to see profit")).toBeTruthy();
  expect(row("Selling price")).toBe("—");
  expect(row("Below market")).toBe("—");
  expect(row("Total cost")).toBe("₱0.00");
});

test("a loss is red with a true minus sign", () => {
  const totals = { ...SPEC_TOTALS, profit: "-700.00", profit_margin: "-7.78" };
  render(<Summary totals={totals} sellingPrice="9000.00" />);

  expect(screen.getByText("−₱700.00").className).toContain("text-loss");
  expect(screen.getByText("-7.78% margin")).toBeTruthy();
});

test("selling above market reads as 'Above market', unsigned", () => {
  const totals = {
    ...SPEC_TOTALS,
    below_market: "-20000.00",
    below_market_pct: "-66.67",
  };
  render(<Summary totals={totals} sellingPrice="50000.00" />);

  expect(screen.queryByText("Below market")).toBeNull();
  expect(row("Above market")).toBe("₱20,000.00 · 66.67%");
});
