import { PartItem } from "../../../frontend/src/components/PartRow";
import { SOLD_BUILD } from "../../../frontend/src/landingDemo";

const noop = () => {};

/** A still build page for every beat until each gets its scene (specs/todo.md, T68). */
export function PartsStill() {
  const loose = SOLD_BUILD.parts.filter((p) => p.bundle === null);
  return (
    <main className="px-4 pt-7">
      <h1 className="font-serif text-[40px] leading-[44px] font-medium tracking-[-0.01em]">
        {SOLD_BUILD.name}
      </h1>
      <h2 className="mt-8 pb-3 font-serif text-[22px] leading-[28px] font-medium">Parts</h2>
      <ul className="border-t border-line-strong">
        {loose.map((p) => (
          <PartItem key={p.id} part={p} deleting={false} onEdit={noop} onDelete={noop} />
        ))}
      </ul>
    </main>
  );
}
