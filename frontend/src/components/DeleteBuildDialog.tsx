import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { deleteBuild, type BuildDetail } from "../api";
import { buttonDanger, buttonSecondary } from "../ui";

const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** "“X” and its 7 parts and 1 extra cost will be deleted.", leaving out empty lists. */
function deleteMessage(build: BuildDetail): string {
  const children = [
    build.parts.length > 0 && count(build.parts.length, "part", "parts"),
    build.extra_costs.length > 0 &&
      count(build.extra_costs.length, "extra cost", "extra costs"),
  ].filter(Boolean);
  const its = children.length > 0 ? ` and its ${children.join(" and ")}` : "";
  return `“${build.name}”${its} will be deleted. This can’t be undone.`;
}

/** Render only while open; it opens itself as a modal on mount. */
export function DeleteBuildDialog({
  build,
  onClose,
}: {
  build: BuildDetail;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  async function confirm() {
    setDeleting(true);
    setError(false);
    try {
      await deleteBuild(build.id);
      navigate("/");
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
      aria-labelledby="delete-build-title"
      aria-describedby="delete-build-message"
      className="m-auto w-[calc(100%-32px)] max-w-[460px] rounded border border-line-strong bg-bg p-6 text-ink backdrop:bg-ink/45"
    >
      <h2
        id="delete-build-title"
        className="font-serif text-[22px] leading-[28px] font-medium"
      >
        Delete this build?
      </h2>
      <p
        id="delete-build-message"
        className="mt-4 text-[15px] leading-[22px] text-muted"
      >
        {deleteMessage(build)}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-loss">
          Couldn’t delete the build. Check your connection and try again.
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
          {deleting ? "Deleting…" : "Delete build"}
        </button>
      </div>
    </dialog>
  );
}
