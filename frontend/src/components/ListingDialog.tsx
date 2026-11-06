import { useEffect, useId, useRef, useState } from "react";
import type { BuildDetail } from "../api";
import { listingText } from "../listing";
import { buttonPrimary, buttonSecondary, input } from "../ui";
import { useModal } from "./DeleteDialog";

const messages = {
  idle: "",
  copied: "Copied",
  failed:
    "Couldn’t copy. The text is selected: press Ctrl+C, or use your phone’s Copy.",
};

/** The build as a Marketplace post, editable, with Copy (docs/specs/copy-listing.md).
 * Render only while open; each open starts from a freshly made post. */
export function ListingDialog({
  build,
  onClose,
}: {
  build: BuildDetail;
  onClose: () => void;
}) {
  const ref = useModal();
  const id = useId();
  const [text, setText] = useState(() => listingText(build));
  const [status, setStatus] = useState<keyof typeof messages>("idle");
  const textRef = useRef<HTMLTextAreaElement>(null);
  const copyRef = useRef<HTMLButtonElement>(null);
  // After useModal's effect: showModal() moves the focus, so Copy takes it back.
  useEffect(() => copyRef.current?.focus(), []);

  async function copy() {
    try {
      // Missing on insecure pages, which throws here and lands in catch too.
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      textRef.current?.select();
      setStatus("failed");
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={`${id}-title`}
      className="m-auto w-[calc(100%-32px)] max-w-md border border-line-strong bg-surface p-6 text-ink backdrop:bg-ink/40"
    >
      <h2 id={`${id}-title`} className="font-serif text-[22px] font-medium">
        Copy listing
      </h2>
      <p className="mt-1 text-[13px] leading-[18px] text-muted">
        For Facebook Marketplace. Edits here aren’t saved.
      </p>
      <label className="mt-4 block text-[13px] font-medium text-muted">
        Listing
        <textarea
          ref={textRef}
          rows={14}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setStatus("idle");
          }}
          className={`mt-1 resize-y font-normal ${input()}`}
        />
      </label>
      {/* Always there, so screen readers announce it when it changes. */}
      <p
        role="status"
        className={`mt-2 min-h-[18px] text-[13px] leading-[18px] ${status === "failed" ? "text-loss" : "text-muted"}`}
      >
        {messages[status]}
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={buttonSecondary}>
          Close
        </button>
        <button
          ref={copyRef}
          type="button"
          onClick={copy}
          className={buttonPrimary}
        >
          Copy
        </button>
      </div>
    </dialog>
  );
}
