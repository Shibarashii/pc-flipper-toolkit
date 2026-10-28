import type { BuildDetail, Totals } from "../api";

/** The SPEC's worked example: ₱3,700.00 profit on a ₱50,000.00 sale. */
export const SPEC_TOTALS: Totals = {
  listed_total: "52000.00",
  parts_cost: "45500.00",
  extra_costs: "800.00",
  total_cost: "46300.00",
  profit: "3700.00",
  profit_margin: "7.40",
  below_market: "2000.00",
  below_market_pct: "3.85",
  voucher_savings: "6500.00",
};

export const EMPTY_TOTALS: Totals = {
  listed_total: "0.00",
  parts_cost: "0.00",
  extra_costs: "0.00",
  total_cost: "0.00",
  profit: null,
  profit_margin: null,
  below_market: null,
  below_market_pct: null,
  voucher_savings: "0.00",
};

export const makeBuild = (
  overrides: Partial<BuildDetail> = {},
): BuildDetail => ({
  id: 3,
  name: "Ryzen 5 7600 + RTX 4060",
  status: "planning",
  selling_price: null,
  sold_at: null,
  notes: "",
  created_at: "2026-10-26T14:30:00+08:00",
  totals: EMPTY_TOTALS,
  parts: [],
  bundles: [],
  extra_costs: [],
  ...overrides,
});
