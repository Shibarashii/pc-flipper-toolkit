import fanHub from "../assets/fan-hub.svg";
import rearFan from "../assets/rear-fan.svg";
import type { PartCategory } from "../api";
import type { Slot, SlotState } from "../slots";

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

/** The 300×380 case schematic: each slot filled, missing or optional. A picture only: what
 * it shows is said in words wherever it's used. */
export function BuildDiagram({ slots }: { slots: Slot[] }) {
  const stateOf = Object.fromEntries(slots.map((s) => [s.category, s.state]));
  return (
    <div aria-hidden className="relative h-[380px] w-[300px] shrink-0">
      {(Object.keys(DIAGRAM) as (keyof typeof DIAGRAM)[]).map((category) => (
        <div
          key={category}
          className={`absolute flex items-center justify-center rounded border text-[13px] leading-[18px] font-medium ${SLOT_STYLE[stateOf[category]]} ${DIAGRAM[category]}`}
        >
          {slots.find((s) => s.category === category)?.label}
        </div>
      ))}
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
  );
}
