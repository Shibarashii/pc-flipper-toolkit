import { expect, test } from "vitest";
import type { Part, PartCategory } from "./api";
import { buildSlots, REQUIRED_SLOTS } from "./slots";

const part = (category: PartCategory, name: string = category): Part => ({
  id: 0,
  build: 1,
  name,
  category,
  shop: "",
  listed_price: "0.00",
  bought_for: "0.00",
  bundle: null,
});

const stateOf = (parts: Part[]) =>
  Object.fromEntries(buildSlots(parts).slots.map((s) => [s.category, s.state]));

test("six slots are required", () => {
  expect(REQUIRED_SLOTS).toBe(6);
});

test("no parts: required slots are missing, optional ones optional", () => {
  expect(stateOf([])).toEqual({
    cpu: "missing",
    motherboard: "missing",
    cooler: "optional",
    ram: "missing",
    storage: "missing",
    gpu: "optional",
    psu: "missing",
    case: "missing",
  });
  expect(buildSlots([]).filled).toBe(0);
});

test("a slot is filled by any part in its category, and lists them all", () => {
  const { slots, filled } = buildSlots([
    part("cpu", "Ryzen 5 5600G"),
    part("ram", "8GB stick"),
    part("ram", "8GB stick #2"),
    part("gpu"),
  ]);

  expect(slots.find((s) => s.category === "ram")?.parts).toEqual([
    "8GB stick",
    "8GB stick #2",
  ]);
  // The GPU is filled but optional, so it doesn't count.
  expect(slots.find((s) => s.category === "gpu")?.state).toBe("filled");
  expect(filled).toBe(2);
});

test("all six required parts, no optional ones, is complete", () => {
  const required: PartCategory[] = [
    "cpu",
    "motherboard",
    "ram",
    "storage",
    "psu",
    "case",
  ];
  expect(buildSlots(required.map((c) => part(c))).filled).toBe(6);
});

test("'other' parts have no slot", () => {
  const { slots, filled } = buildSlots([part("other", "RGB strip")]);
  expect(slots.map((s) => s.category)).not.toContain("other");
  expect(slots.every((s) => s.parts.length === 0)).toBe(true);
  expect(filled).toBe(0);
});
