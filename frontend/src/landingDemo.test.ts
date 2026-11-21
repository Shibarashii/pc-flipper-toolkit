// The landing page's numbers are typed by hand: check they add up.
import { expect, test } from "vitest";
import { SOLD_BUILD } from "./landingDemo";

const cents = (value: string) => Math.round(Number(value) * 100);
const sum = (values: string[]) => values.reduce((n, v) => n + cents(v), 0);

test("the demo's sold build adds up", () => {
  const { parts, extraCosts, sellingPrice, totals } = SOLD_BUILD;
  expect(sum(parts.map((p) => p.listed_price))).toBe(
    cents(totals.listed_total),
  );
  expect(sum(extraCosts.map((c) => c.amount))).toBe(cents(totals.extra_costs));
  expect(cents(totals.parts_cost) + cents(totals.extra_costs)).toBe(
    cents(totals.total_cost),
  );
  expect(cents(sellingPrice) - cents(totals.total_cost)).toBe(
    cents(totals.profit),
  );
  expect(
    ((Number(totals.profit) / Number(sellingPrice)) * 100).toFixed(2),
  ).toBe(totals.profit_margin);
});
