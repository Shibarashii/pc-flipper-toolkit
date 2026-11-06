import { CATEGORIES, type BuildDetail } from "./api";
import { formatMoney } from "./money";
import { buildSlots } from "./slots";

/** ["A", "A", "B"] → "2× A + B", in the order first entered. */
function joinNames(names: string[]): string {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts]
    .map(([name, n]) => (n > 1 ? `${n}× ${name}` : name))
    .join(" + ");
}

/** A Facebook Marketplace post for the build (docs/specs/copy-listing.md). Only names,
 * slots and the selling price: never what was paid, shops, profit or notes. */
export function listingText(build: BuildDetail): string {
  const groups = [
    ...buildSlots(build.parts).slots.map((s) => ({
      label: s.label,
      names: s.parts,
    })),
    {
      label: CATEGORIES.other,
      names: build.parts
        .filter((p) => p.category === "other")
        .map((p) => p.name),
    },
  ];
  const lines = groups
    .filter((g) => g.names.length > 0)
    .map((g) => `${g.label}: ${joinNames(g.names)}`);

  const sections = [build.name, lines.join("\n")];
  if (build.selling_price !== null)
    sections.push(
      `Price: ${formatMoney(build.selling_price).replace(/\.00$/, "")}`,
    );
  return sections.filter(Boolean).join("\n\n");
}
