// Pieces shared by the inline add/edit forms for parts and extra costs.
import type { ComponentProps, ReactNode } from "react";
import chevron from "../assets/chevron.svg";
import pencil from "../assets/pencil.svg";
import trash from "../assets/trash.svg";
import { iconButton, input } from "../ui";

/** "₱12,500" → "12500": people type (or paste from shops) the peso sign and
 * thousands separators; the API accepts neither. */
export const cleanMoney = (value: string) => value.replace(/[₱,]/g, "").trim();

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

/** A 28×28 pencil or trash button. `label` is its accessible name. */
export function IconButton({
  action,
  label,
  onClick,
  disabled = false,
}: {
  action: "edit" | "delete";
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={iconButton}
    >
      <img
        src={action === "edit" ? pencil : trash}
        alt=""
        width={16}
        height={16}
      />
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
