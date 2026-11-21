import type { Part, PartCategory } from "../api";
import check from "../assets/check.svg";
import dash from "../assets/dash.svg";
import slotMissing from "../assets/slot-missing.png";
import { buildSlots, REQUIRED_SLOTS, type SlotState } from "../slots";
import { link } from "../ui";
import { BuildDiagram } from "./BuildDiagram";

// `title` is the tooltip; screen readers skip the mark, since the row's text says it.
const MARK: Record<SlotState, { src: string; size: number; title: string }> = {
  filled: { src: check, size: 16, title: "Added" },
  missing: { src: slotMissing, size: 12, title: "Missing" },
  optional: { src: dash, size: 16, title: "Optional" },
};

const VALUE_COLOR: Record<SlotState, string> = {
  filled: "text-ink",
  missing: "text-muted",
  optional: "text-faint",
};

/** The case diagram and the 8-slot checklist, worked out from the parts list. */
export function BuildChecklist({
  parts,
  onAdd,
}: {
  parts: Part[];
  /** Opens the add-part row with this category picked. */
  onAdd: (category: PartCategory) => void;
}) {
  const { slots, filled } = buildSlots(parts);

  return (
    <section aria-labelledby="build-title">
      <div className="flex items-center gap-3 pb-3">
        <h2
          id="build-title"
          className="font-serif text-[22px] leading-[28px] font-medium"
        >
          Build
        </h2>
        <p className="flex-1 text-[13px] leading-[18px] text-muted">
          {filled} of {REQUIRED_SLOTS} required parts
        </p>
      </div>
      <div aria-hidden className="h-[3px] bg-line">
        <div
          className="h-full bg-accent"
          style={{ width: `${(filled / REQUIRED_SLOTS) * 100}%` }}
        />
      </div>

      <div className="flex flex-col items-center gap-5 pt-5 sm:flex-row sm:items-start sm:gap-8">
        <BuildDiagram slots={slots} />

        <ul className="w-full min-w-0 flex-1 border-t border-line-strong">
          {slots.map((slot) => (
            <li
              key={slot.category}
              className="flex items-center gap-3 border-b border-line px-3 py-2"
            >
              <span className="flex size-4 shrink-0 items-center justify-center">
                <img
                  src={MARK[slot.state].src}
                  alt=""
                  title={MARK[slot.state].title}
                  width={MARK[slot.state].size}
                  height={MARK[slot.state].size}
                />
              </span>
              <span className="w-[92px] shrink-0 text-[13px] leading-[18px] font-medium text-muted">
                {slot.label}
              </span>
              <span
                className={`min-w-0 flex-1 text-[15px] leading-[22px] ${VALUE_COLOR[slot.state]}`}
              >
                {slot.state === "filled"
                  ? slot.parts.join(", ")
                  : (slot.note ?? "Not added")}
              </span>
              {slot.state !== "filled" && (
                <button
                  type="button"
                  aria-label={`Add ${slot.label}`}
                  onClick={() => onAdd(slot.category)}
                  className={`shrink-0 ${link}`}
                >
                  Add
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
