// Pieces shared by the inline add/edit forms for parts, bundles and extra costs.
import { useState, type ComponentProps, type ReactNode } from "react";
import { ApiError, type FieldErrors } from "../api";
import chevron from "../assets/chevron.svg";
import { iconButton, iconButtonBordered, input } from "../ui";

/** "₱12,500" → "12500": people type (or paste from shops) the peso sign and
 * thousands separators; the API accepts neither. */
export const cleanMoney = (value: string) => value.replace(/[₱,]/g, "").trim();

/** Saving state for an inline form. `save(work)` runs the request; a 400 puts each
 * message under its field, and `failed` covers the rest (no connection, or an error on
 * a field the form doesn't show; `error` is what was thrown, for `generalError`). `shown`
 * is the form's fields, e.g. its EMPTY. */
export function useSave(shown: Record<string, string>) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  async function save(work: () => Promise<void>) {
    setSaving(true);
    setErrors({});
    setFailed(false);
    try {
      await work();
    } catch (err) {
      const fieldErrors = err instanceof ApiError ? err.fieldErrors : {};
      setError(err);
      setErrors(fieldErrors);
      setFailed(!Object.keys(fieldErrors).some((key) => key in shown));
    } finally {
      setSaving(false);
    }
  }

  return { errors, error, failed, saving, save };
}

/** The pencil and trash buttons at the end of a row. `name` labels them for screen readers. */
export function RowActions({
  name,
  deleting,
  onEdit,
  onDelete,
}: {
  name: string;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-0.5">
      <IconButton action="edit" label={`Edit ${name}`} onClick={onEdit} />
      <IconButton
        action="delete"
        label={`Delete ${name}`}
        onClick={onDelete}
        disabled={deleting}
      />
    </div>
  );
}

// Drawn inline in `currentColor`, so each takes its button's text colour in both themes.
const svgProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const ICONS = {
  edit: {
    color: "text-muted",
    svg: (
      <svg {...svgProps}>
        <path d="pencil" />
      </svg>
    ),
  },
  delete: {
    color: "text-loss",
    svg: (
      <svg {...svgProps}>
        <path d="M2 4h12M12.667 4v9.333c0 .667-.667 1.334-1.334 1.334H4.667c-.667 0-1.334-.667-1.334-1.334V4M5.333 4V2.667c0-.667.667-1.334 1.334-1.334h2.666c.667 0 1.334.667 1.334 1.334V4" />
      </svg>
    ),
  },
  // A sheet with lines: the listing.
  listing: {
    color: "text-ink",
    svg: (
      <svg {...svgProps}>
        <rect x="3" y="1.333" width="10" height="13.333" rx="1.333" />
        <path d="M5.667 5.333h4.666M5.667 8h4.666M5.667 10.667h2.666" />
      </svg>
    ),
  },
};

/** A 16px icon button: 28×28 in a row, or 38×38 with a border (`bordered`) in the build
 * header. `label` is its accessible name and its tooltip. */
export function IconButton({
  action,
  label,
  onClick,
  disabled = false,
  bordered = false,
}: {
  action: keyof typeof ICONS;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  bordered?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`${bordered ? iconButtonBordered : iconButton} ${ICONS[action].color}`}
    >
      {ICONS[action].svg}
    </button>
  );
}

export function Field({
  label,
  errors,
  labelClass = "",
  className = "",
  children,
}: {
  label: string;
  errors?: string[];
  /** Extra classes for the label text, e.g. "sm:sr-only" on the compact add row. */
  labelClass?: string;
  className?: string;
  children: ReactNode;
}) {
  // Errors sit outside the <label> so they aren't read as part of the field's name.
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="flex flex-col gap-1.5">
        <span
          className={`text-[13px] leading-[18px] font-medium text-muted ${labelClass}`}
        >
          {label}
        </span>
        {children}
      </label>
      {errors?.map((message) => (
        <p key={message} className="text-[13px] leading-[18px] text-loss">
          {message}
        </p>
      ))}
    </div>
  );
}

/** A native <select> styled like the inputs, with the brand chevron. */
export function Select({
  error = false,
  className = "",
  ...props
}: ComponentProps<"select"> & { error?: boolean }) {
  return (
    <div className="relative">
      <select
        {...props}
        aria-invalid={error}
        className={`${input(error)} appearance-none pr-8 ${className}`}
      />
      <img
        src={chevron}
        alt=""
        width={16}
        height={16}
        className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2"
      />
    </div>
  );
}

export type SaveState = "idle" | "saving" | "saved" | "failed";

const SAVE_TEXT: Record<SaveState, string> = {
  idle: "",
  saving: "Saving…",
  saved: "Saved",
  failed: "Couldn’t save. Check your connection and try again.",
};

/** "Saving…" → "Saved" next to fields that save on their own (no Save button). */
export function SaveStatus({
  state,
  className = "",
}: {
  state: SaveState;
  className?: string;
}) {
  return (
    <p
      role={state === "failed" ? "alert" : "status"}
      className={`text-[13px] leading-[18px] ${state === "failed" ? "text-loss" : "text-muted"} ${className}`}
    >
      {SAVE_TEXT[state]}
    </p>
  );
}

/** A ref that focuses its element once it appears: for the message or heading that replaces
 * a form, so keyboard and screen-reader users carry on from there. Give it `tabIndex={-1}`. */
export const focusOnMount = (el: HTMLElement | null) => el?.focus();
