import { expect, test } from "vitest";
import type { Part, PartCategory } from "./api";
import { listingText } from "./listing";
import { makeBuild, SPEC_TOTALS } from "./test/fixtures";

let nextId = 1;
const part = (
  category: PartCategory,
  name: string,
  extra: Partial<Part> = {},
): Part => ({
  id: String(nextId++),
  build: "3",
  name,
  category,
  shop: "",
  condition: "",
  listed_price: "0.00",
  bought_for: null,
  bundle: null,
  ...extra,
});

test("the demo's sold build gives the spec's post", () => {
  const build = makeBuild({
    name: "Ryzen 5 5600 + RX 6600",
    status: "sold",
    selling_price: "32000.00",
    // Entered in a different order from the slots, like a real build.
    parts: [
      part("gpu", "RX 6600 8GB"),
      part("cpu", "Ryzen 5 5600", { bundle: "1" }),
      part("motherboard", "MSI B550M Pro-VDH", { bundle: "1" }),
      part("ram", "16GB DDR4 3200", { bundle: "1" }),
      part("storage", "1TB NVMe SSD"),
      part("psu", "650W 80+ Bronze"),
      part("case", "Tecware Nexus Air"),
    ],
  });

  expect(listingText(build)).toBe(
    `Ryzen 5 5600 + RX 6600

CPU: Ryzen 5 5600
Motherboard: MSI B550M Pro-VDH
RAM: 16GB DDR4 3200
Storage: 1TB NVMe SSD
GPU: RX 6600 8GB
PSU: 650W 80+ Bronze
Case: Tecware Nexus Air

Price: ₱32,000`,
  );
});

test("slots in checklist order, empty ones left out, Other last", () => {
  const build = makeBuild({
    name: "Mixed",
    parts: [
      part("other", "Wi-Fi card"),
      part("case", "Case A"),
      part("cooler", "Tower cooler"),
      part("cpu", "CPU A"),
    ],
  });

  expect(listingText(build)).toBe(
    `Mixed

CPU: CPU A
Cooler: Tower cooler
Case: Case A
Other: Wi-Fi card`,
  );
});

test("the same name twice is 2×; different names are joined with +", () => {
  const build = makeBuild({
    name: "Two of a kind",
    parts: [
      part("ram", "Kingston 8GB"),
      part("storage", "1TB NVMe SSD"),
      part("ram", "Kingston 8GB"),
      part("storage", "2TB HDD"),
      part("other", "Fan"),
      part("other", "Fan"),
      part("other", "RGB strip"),
    ],
  });

  expect(listingText(build)).toBe(
    `Two of a kind

RAM: 2× Kingston 8GB
Storage: 1TB NVMe SSD + 2TB HDD
Other: 2× Fan + RGB strip`,
  );
});

test("no parts and no price: just the name", () => {
  expect(listingText(makeBuild({ name: "Empty" }))).toBe("Empty");
});

test("no parts with a price: the name and the price", () => {
  expect(
    listingText(makeBuild({ name: "Empty", selling_price: "15000.00" })),
  ).toBe("Empty\n\nPrice: ₱15,000");
});

test("centavos are kept when there are some", () => {
  expect(
    listingText(makeBuild({ name: "Odd", selling_price: "32000.50" })),
  ).toBe("Odd\n\nPrice: ₱32,000.50");
});

test("never shows what was paid, listed prices, shops, extra costs, profit, status or notes", () => {
  const build = makeBuild({
    name: "Private",
    status: "listed",
    selling_price: "50000.00",
    notes: "Buyer from Marikina, meetup Sat",
    totals: SPEC_TOTALS,
    parts: [
      part("cpu", "Ryzen 5 5600", {
        shop: "PC Express",
        listed_price: "7777.00",
        bought_for: "6666.00",
        bundle: "9",
      }),
    ],
    bundles: [
      {
        id: "9",
        build: "3",
        name: "Secret bundle",
        shop: "Facebook",
        bought_for: "5555.00",
        listed_total: "8888.00",
        unassigned: "0.00",
      },
    ],
    extra_costs: [
      { id: "1", build: "3", label: "Thermal paste", amount: "444.00" },
    ],
  });

  const text = listingText(build);

  expect(text).toBe("Private\n\nCPU: Ryzen 5 5600\n\nPrice: ₱50,000");
  for (const secret of [
    "7,777",
    "6,666",
    "5,555",
    "8,888",
    "444",
    "3,700",
    "PC Express",
    "Facebook",
    "Secret bundle",
    "Thermal paste",
    "Marikina",
    "Listed",
    "listed",
  ])
    expect(text).not.toContain(secret);
});

test("a part's condition follows its name in brackets, with Facebook's label", () => {
  const build = makeBuild({
    name: "Mixed",
    parts: [
      part("cpu", "Ryzen 5 5600", { condition: "new" }),
      part("gpu", "RX 6600 8GB", { condition: "like_new" }),
      part("psu", "650W 80+ Bronze", { condition: "good" }),
      part("case", "Old case", { condition: "fair" }),
      part("storage", "1TB NVMe SSD"),
    ],
  });

  expect(listingText(build)).toBe(
    `Mixed

CPU: Ryzen 5 5600 (New)
Storage: 1TB NVMe SSD
GPU: RX 6600 8GB (Used – Like New)
PSU: 650W 80+ Bronze (Used – Good)
Case: Old case (Used – Fair)`,
  );
});

test("the same name groups as 2× only with the same condition", () => {
  const build = makeBuild({
    name: "RAM",
    parts: [
      part("ram", "8GB DDR4", { condition: "new" }),
      part("ram", "8GB DDR4", { condition: "new" }),
      part("storage", "8GB DDR4", { condition: "new" }),
      part("storage", "8GB DDR4", { condition: "good" }),
      part("other", "Fan"),
      part("other", "Fan", { condition: "new" }),
    ],
  });

  expect(listingText(build)).toBe(
    `RAM

RAM: 2× 8GB DDR4 (New)
Storage: 8GB DDR4 (New) + 8GB DDR4 (Used – Good)
Other: Fan + Fan (New)`,
  );
});
