import type { Part, PartCategory } from "../api";
import check from "../assets/check.svg";
import dash from "../assets/dash.svg";
import fanHub from "../assets/fan-hub.svg";
import rearFan from "../assets/rear-fan.svg";
import slotMissing from "../assets/slot-missing.png";
import { buildSlots, REQUIRED_SLOTS, type SlotState } from "../slots";
import { link } from "../ui";

// Where each slot sits in the 300×380 case diagram, drawn back to front.
const DIAGRAM: Record<Exclude<PartCategory, "other">, string> = {
  case: "inset-0 items-end justify-end rounded-[12px] pr-[14px] pb-[10px]",
  motherboard:
    "top-[20px] left-[20px] h-[236px] w-[204px] items-start justify-start pt-[8px] pl-[10px]",
  // Label at the top of the ring: the CPU sits in the middle, over the centre.
  cooler:
    "top-[44px] left-[40px] size-[96px] items-start rounded-full pt-[3px]",
  cpu: "top-[64px] left-[60px] size-[56px]",
  ram: "top-[44px] left-[150px] h-[104px] w-[48px]",
  storage: "top-[154px] left-[40px] h-[26px] w-[116px]",
  gpu: "top-[194px] left-[28px] h-[52px] w-[248px]",
  psu: "top-[290px] left-[20px] h-[68px] w-[136px]",
};

const SLOT_STYLE: Record<SlotState, string> = {
  filled: "border-solid border-accent bg-slot-fill text-ink",
  missing: "border-dashed border-muted text-muted",
  optional: "border-dotted border-line-strong text-faint",
};

const MARK: Record<SlotState, { src: string; size: number }> = {
  filled: { src: check, size: 16 },
  missing: { src: slotMissing, size: 12 },
  optional: { src: dash, size: 16 },
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
  const stateOf = Object.fromEntries(slots.map((s) => [s.category, s.state]));

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
        {/* The checklist says the same thing in words, so the picture is hidden from screen readers. */}
        <div aria-hidden className="relative h-[380px] w-[300px] shrink-0">
          {(Object.keys(DIAGRAM) as (keyof typeof DIAGRAM)[]).map(
            (category) => (
              <div
                key={category}
                className={`absolute flex items-center justify-center rounded border text-[13px] leading-[18px] font-medium ${SLOT_STYLE[stateOf[category]]} ${DIAGRAM[category]}`}
              >
                {slots.find((s) => s.category === category)?.label}
              </div>
            ),
          )}
          <img
            src={rearFan}
            alt=""
            width={44}
            height={44}
            className="absolute top-[34px] left-[238px]"
          />
          <img
            src={fanHub}
            alt=""
            width={8}
            height={8}
            className="absolute top-[52px] left-[256px]"
          />
        </div>

        <ul className="w-full min-w-0 flex-1 border-t border-line-strong">
          {slots.map((slot) => (
            <li
              key={slot.category}
              className="flex items-center gap-3 border-b border-line py-2"
            >
              <span className="flex size-4 shrink-0 items-center justify-center">
                <img
                  src={MARK[slot.state].src}
                  alt=""
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
