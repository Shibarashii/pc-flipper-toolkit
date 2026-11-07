import { CATEGORIES, CONDITIONS, type BuildDetail, type Part } from "./api";
import { formatMoney } from "./money";
import { buildSlots } from "./slots";

/** "RX 6600 8GB (Used – Like New)", or just the name without a condition. */
const withCondition = (p: Part) =>
  p.condition ? `${p.name} (${CONDITIONS[p.condition]})` : p.name;

/** ["A", "A", "B"] → "2× A + B", in the order first entered. */
function joinNames(names: string[]): string {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts]
    .map(([name, n]) => (n > 1 ? `${n}× ${name}` : name))
    .join(" + ");
}

/** A Facebook Marketplace post for the build (docs/specs/copy-listing.md). Only names,
 * conditions, slots and the selling price: never what was paid, shops, profit or notes. */
export function listingText(build: BuildDetail): string {
  // The checklist's slot order, then Other.
  const slots = [
    ...buildSlots(build.parts).slots,
    { label: CATEGORIES.other, category: "other" },
  ];
  const lines = slots
    .map(({ label, category }) => ({
      label,
      // Name and condition together, so only matching ones group as 2×.
      names: build.parts
        .filter((p) => p.category === category)
        .map(withCondition),
    }))
    .filter((g) => g.names.length > 0)
    .map((g) => `${g.label}: ${joinNames(g.names)}`);

  const sections = [build.name, lines.join("\n")];
  if (build.selling_price !== null)
    sections.push(
      `Price: ${formatMoney(build.selling_price).replace(/\.00$/, "")}`,
    );
  return sections.filter(Boolean).join("\n\n");
}
