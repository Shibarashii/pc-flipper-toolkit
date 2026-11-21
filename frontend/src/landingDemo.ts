// The demo's sold build (backend/builds/demo.py), as fixed data for the landing page's
// pictures. Keep the two in step: the page promises the demo shows the same build.
import type { Part, PartCategory, PartCondition, Totals } from "./api";

const part = (
  name: string,
  category: PartCategory,
  listed_price: string,
  bought_for: string | null,
  condition: PartCondition,
  bundle: string | null = null,
): Part => ({
  id: name,
  build: "sold",
  name,
  category,
  shop: "",
  condition,
  listed_price,
  bought_for,
  bundle,
});

export const SOLD_BUILD = {
  name: "Ryzen 5 5600 + RX 6600",
  parts: [
    part("Ryzen 5 5600", "cpu", "6500.00", null, "good", "bundle"),
    part(
      "MSI B550M Pro-VDH",
      "motherboard",
      "5500.00",
      "4000.00",
      "good",
      "bundle",
    ),
    part("16GB DDR4 3200", "ram", "2200.00", null, "good", "bundle"),
    part("RX 6600 8GB", "gpu", "13000.00", "11000.00", "new"),
    part("1TB NVMe SSD", "storage", "3200.00", "2600.00", "new"),
    part("650W 80+ Bronze", "psu", "3000.00", "2400.00", "new"),
    part("Tecware Nexus Air", "case", "2500.00", "1800.00", "new"),
  ],
  sellingPrice: "32000.00",
  totals: {
    listed_total: "35900.00",
    parts_cost: "27300.00",
    extra_costs: "500.00",
    total_cost: "27800.00",
    profit: "4200.00",
    profit_margin: "13.13",
    below_market: "3900.00",
    below_market_pct: "10.86",
    voucher_savings: "8600.00",
  } satisfies Totals,
};
