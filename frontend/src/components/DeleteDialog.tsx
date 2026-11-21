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
  return (
    <ConfirmDialog
      title={`Delete this ${what}?`}
      message={message}
      action={`Delete ${what}`}
      running="Deleting…"
      error={`Couldn’t delete the ${what}. Check your connection and try again.`}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}

/** A question with Cancel and a red action, for anything that can't be taken back
 * (docs/specs/confirm-dialogs.md). Render only while open; it opens itself as a modal. */
export function ConfirmDialog({
  title,
  message,
  action,
  running = action,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  action: string;
  /** The action's label while onConfirm runs. */
  running?: string;
  /** Shown when onConfirm throws; the dialog stays open. */
  error?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const ref = useModal();
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    setBusy(true);
    setFailed(false);
    try {
      await onConfirm();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    // Cancel comes first, so it's what showModal() focuses: Enter never acts by accident.
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
        {title}
      </h2>
      <p
        id={`${id}-message`}
        className="mt-4 text-[15px] leading-[22px] text-muted"
      >
        {message}
      </p>
      {failed && error && (
        <p role="alert" className="mt-2 text-[13px] text-loss">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={buttonSecondary}>
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className={buttonDanger}
        >
          {busy ? running : action}
        </button>
      </div>
    </dialog>
  );
}
