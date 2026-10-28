import { CATEGORIES, type Part, type PartCategory } from "./api";

export type SlotState = "filled" | "missing" | "optional";

export type Slot = {
  category: PartCategory;
  label: string;
  state: SlotState;
  /** Names of the parts in this slot, e.g. two RAM kits. */
  parts: string[];
  /** Shown when an optional slot is empty. */
  note?: string;
};

// The diagram's slots, in checklist order. "other" parts have no slot.
const SLOTS: { category: PartCategory; optional?: string }[] = [
  { category: "cpu" },
  { category: "motherboard" },
  { category: "cooler", optional: "Optional — stock cooler is fine" },
  { category: "ram" },
  { category: "storage" },
  { category: "gpu", optional: "Optional — not needed with an APU" },
  { category: "psu" },
  { category: "case" },
];

export const REQUIRED_SLOTS = SLOTS.filter((s) => !s.optional).length;

/** Which slots a build's parts fill, and how many of the required ones. */
export function buildSlots(parts: Part[]): { slots: Slot[]; filled: number } {
  const slots = SLOTS.map(({ category, optional }): Slot => {
    const names = parts
      .filter((p) => p.category === category)
      .map((p) => p.name);
    let state: SlotState = "filled";
    if (names.length === 0) state = optional ? "optional" : "missing";
    return {
      category,
      label: CATEGORIES[category],
      state,
      parts: names,
      note: optional,
    };
  });
  // Optional slots carry a note; only the others count.
  const filled = slots.filter((s) => s.state === "filled" && !s.note).length;
  return { slots, filled };
}
