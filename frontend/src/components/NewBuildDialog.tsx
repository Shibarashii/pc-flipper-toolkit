import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { useNavigate } from "react-router";
import { createBuild } from "../api";

/** Render only while open; it opens itself as a modal on mount. */
export function NewBuildDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(false);
    try {
      const build = await createBuild(trimmed);
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
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ryzen 5 7600 + RTX 4060"
            className="mt-1 block w-full rounded border border-line-strong bg-surface px-3 py-2 text-[15px] font-normal text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>
        {error && (
          <p role="alert" className="mt-2 text-[13px] text-loss">
            Couldn’t create the build. Try again.
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-line-strong bg-surface px-4 py-2 text-[14px] font-medium hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded bg-accent px-4 py-2 text-[14px] font-medium text-on-accent hover:bg-accent-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {saving ? "Creating…" : "Create build"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
