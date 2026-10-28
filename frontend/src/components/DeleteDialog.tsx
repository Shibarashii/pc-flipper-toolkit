import { useEffect, useId, useRef, useState } from "react";
import { buttonDanger, buttonSecondary } from "../ui";

/** A ref for a <dialog> that opens itself as a modal on mount. */
export function useModal() {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return ref;
}

/** "Delete this {what}?" with Cancel and a red "Delete {what}". Render only while open;
 * it opens itself as a modal on mount. */
export function DeleteDialog({
  what,
  message,
  onConfirm,
  onClose,
}: {
  what: string;
  message: string;
  /** Does the delete; a throw keeps the dialog open with an error. */
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const ref = useModal();
  const id = useId();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(false);

  async function confirm() {
    setDeleting(true);
    setError(false);
    try {
      await onConfirm();
    } catch {
      setError(true);
      setDeleting(false);
    }
  }

  return (
    // Cancel comes first, so it's what showModal() focuses: Enter never deletes by accident.
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
      className="m-auto w-[calc(100%-32px)] max-w-[460px] rounded border border-line-strong bg-bg p-6 text-ink backdrop:bg-ink/45"
    >
      <h2
        id={`${id}-title`}
        className="font-serif text-[22px] leading-[28px] font-medium"
      >
        Delete this {what}?
      </h2>
      <p
        id={`${id}-message`}
        className="mt-4 text-[15px] leading-[22px] text-muted"
      >
        {message}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-loss">
          Couldn’t delete the {what}. Check your connection and try again.
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={buttonSecondary}>
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={deleting}
          className={buttonDanger}
        >
          {deleting ? "Deleting…" : `Delete ${what}`}
        </button>
      </div>
    </dialog>
  );
}
