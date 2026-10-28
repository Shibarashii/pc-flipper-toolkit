import { useState, type SubmitEvent } from "react";
import { useNavigate } from "react-router";
import { createBuild } from "../api";
import { buttonPrimary, buttonSecondary, input } from "../ui";
import { useModal } from "./DeleteDialog";

/** Render only while open; it opens itself as a modal on mount. */
export function NewBuildDialog({ onClose }: { onClose: () => void }) {
  const ref = useModal();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(false);
    try {
      // Can't be blank: the submit button is disabled until there's a name.
      const build = await createBuild(name.trim());
      navigate(`/builds/${build.id}`);
    } catch {
      setError(true);
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="new-build-title"
      className="m-auto w-[calc(100%-32px)] max-w-md border border-line-strong bg-surface p-6 text-ink backdrop:bg-ink/40"
    >
      <form onSubmit={submit}>
        <h2 id="new-build-title" className="font-serif text-[22px] font-medium">
          New build
        </h2>
        <label className="mt-4 block text-[13px] font-medium text-muted">
          Name
          <input
            autoFocus
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ryzen 5 7600 + RTX 4060"
            className={`mt-1 font-normal ${input()}`}
          />
        </label>
        {error && (
          <p role="alert" className="mt-2 text-[13px] text-loss">
            Couldn’t create the build. Try again.
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={buttonSecondary}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className={buttonPrimary}
          >
            {saving ? "Creating…" : "Create build"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
