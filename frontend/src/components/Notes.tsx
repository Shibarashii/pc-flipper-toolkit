import { useState } from "react";
import { updateBuild, type BuildDetail } from "../api";

type SaveState = "idle" | "saving" | "saved" | "failed";

const STATUS_TEXT: Record<SaveState, string> = {
  idle: "",
  saving: "Saving…",
  saved: "Saved",
  failed: "Couldn’t save. Check your connection and try again.",
};

/** A plain textarea that saves on blur. */
export function Notes({
  build,
  onUpdated,
}: {
  build: BuildDetail;
  onUpdated: (build: BuildDetail) => void;
}) {
  const [notes, setNotes] = useState(build.notes);
  const [state, setState] = useState<SaveState>("idle");

  async function save() {
    if (notes === build.notes) return;
    setState("saving");
    try {
      onUpdated(await updateBuild(build.id, { notes }));
      setState("saved");
    } catch {
      setState("failed");
    }
  }

  return (
    <section aria-labelledby="notes-title">
      <div className="flex items-center gap-3 pb-3">
        <h2
          id="notes-title"
          className="font-serif text-[22px] leading-[28px] font-medium"
        >
          Notes
        </h2>
        <p
          role={state === "failed" ? "alert" : "status"}
          className={`flex-1 text-[13px] leading-[18px] ${state === "failed" ? "text-loss" : "text-faint"}`}
        >
          {STATUS_TEXT[state]}
        </p>
      </div>
      <textarea
        aria-labelledby="notes-title"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={save}
        placeholder="Buyer, payment, anything worth remembering about this flip."
        className="block min-h-[96px] w-full rounded border border-line-strong bg-surface px-3 py-2.5 text-[15px] leading-[22px] text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
    </section>
  );
}
