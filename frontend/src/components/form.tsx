// Pieces shared by the inline add/edit forms for parts and extra costs.
import type { ReactNode } from "react";
import pencil from "../assets/pencil.svg";
import trash from "../assets/trash.svg";
import { iconButton } from "../ui";

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
      <IconButton icon={pencil} label={`Edit ${name}`} onClick={onEdit} />
      <IconButton
        icon={trash}
        label={`Delete ${name}`}
        onClick={onDelete}
        disabled={deleting}
      />
    </div>
  );
}

function IconButton({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: string;
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
      <img src={icon} alt="" width={16} height={16} />
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
