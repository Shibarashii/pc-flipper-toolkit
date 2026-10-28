import { useState, type SubmitEvent } from "react";
import {
  createBundle,
  deleteBundle,
  updateBundle,
  type Bundle,
  type Part,
} from "../api";
import { formatMoney } from "../money";
import { buttonPrimary, buttonSecondary, input } from "../ui";
import { DeleteDialog } from "./DeleteDialog";
import { cleanMoney, Field, RowActions, useSave } from "./form";

const tag =
  "inline-block rounded border border-line-strong px-[7px] text-[13px] leading-[18px]";
const link =
  "rounded text-[13px] leading-[18px] font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** A bundle's own row: one price for the parts listed under it. */
export function BundleItem({
  bundle,
  count,
  deleting,
  onAddPart,
  onEdit,
  onDelete,
}: {
  bundle: Bundle;
  count: number;
  deleting: boolean;
  onAddPart: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = [bundle.shop, `${count} ${count === 1 ? "part" : "parts"}`]
    .filter(Boolean)
    .join(" · ");
  const unassigned = Number(bundle.unassigned) > 0 && (
    <p className="text-[13px] leading-[18px] whitespace-nowrap text-muted">
      {formatMoney(bundle.unassigned)} not assigned
    </p>
  );
  const actions = (
    <RowActions
      name={bundle.name}
      deleting={deleting}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
  const addPart = (text: string) => (
    <button
      type="button"
      onClick={onAddPart}
      aria-label={`Add part to ${bundle.name}`}
      className={`self-start ${link}`}
    >
      {text}
    </button>
  );
  return (
    <div className="border-b border-line py-3.5 sm:py-3">
      {/* Mobile card */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] leading-[22px] font-medium">
              {bundle.name}
            </p>
            <p className="flex items-center gap-1.5 text-[13px] leading-[18px] text-muted">
              <span className={`${tag} text-ink`}>Bundle</span>
              {meta}
            </p>
          </div>
          {actions}
        </div>
        <div className="flex gap-3 tabular-nums">
          <div className="flex-1 text-muted">
            <p className="text-[13px] leading-[18px]">Listed total</p>
            <p className="text-[15px] leading-[22px]">
              {formatMoney(bundle.listed_total)}
            </p>
          </div>
          <div className="flex-1">
            <p className="text-[13px] leading-[18px] text-muted">Bought for</p>
            <p className="text-[15px] leading-[22px] font-medium">
              {formatMoney(bundle.bought_for)}
            </p>
            {unassigned}
          </div>
        </div>
        {addPart("Add part to bundle")}
      </div>

      {/* Desktop row */}
      <div className="hidden items-start gap-4 sm:flex">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-[22px] font-medium">
            {bundle.name}
          </p>
          <p className="flex gap-2.5 text-[13px] leading-[18px] text-muted">
            {meta}
            {addPart("Add part")}
          </p>
        </div>
        <span className="w-[100px]">
          <span className={tag}>Bundle</span>
        </span>
        <span className="w-[110px] text-right text-[15px] leading-[22px] text-muted tabular-nums">
          {formatMoney(bundle.listed_total)}
        </span>
        {/* The remainder may run wider than the column, into the gap on its left. */}
        <div className="flex w-[110px] flex-col items-end tabular-nums">
          <span className="text-[15px] leading-[22px] font-medium">
            {formatMoney(bundle.bought_for)}
          </span>
          {unassigned}
        </div>
        {actions}
      </div>
    </div>
  );
}

const EMPTY = { name: "", shop: "", bought_for: "" };

/** The inline add/edit row for a bundle: name, shop and the one price paid. */
export function BundleForm({
  bundle,
  buildId,
  onSaved,
  onClose,
}: {
  /** The bundle to edit; omit to add a new one. */
  bundle?: Bundle;
  buildId: number;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(
    bundle
      ? {
          name: bundle.name,
          shop: bundle.shop,
          bought_for: formatMoney(bundle.bought_for),
        }
      : EMPTY,
  );
  const { errors, failed, saving, save } = useSave(EMPTY);
  const title = bundle ? "Edit bundle" : "New bundle";

  const set = (field: keyof typeof EMPTY) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const fields = {
      name: form.name.trim(),
      shop: form.shop.trim(),
      bought_for: cleanMoney(form.bought_for),
    };
    save(async () => {
      if (bundle) await updateBundle(bundle.id, fields);
      else await createBundle({ build: buildId, ...fields });
      onSaved();
    });
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      aria-label={bundle ? `Edit ${bundle.name}` : title}
    >
      <div className="flex flex-col gap-3 rounded bg-sunken p-3 sm:flex-row sm:items-start sm:gap-2 sm:p-2">
        <p className="text-[13px] leading-[18px] font-medium sm:hidden">
          {title}
        </p>
        <Field
          label="Bundle"
          errors={errors.name}
          labelClass="sm:sr-only"
          className="sm:flex-1"
        >
          <input
            autoFocus
            value={form.name}
            onChange={(e) => set("name")(e.target.value)}
            placeholder="Bundle name"
            maxLength={200}
            aria-invalid={!!errors.name}
            className={input(!!errors.name)}
          />
        </Field>
        <Field
          label="Shop"
          errors={errors.shop}
          labelClass="sm:sr-only"
          className="sm:w-[180px]"
        >
          <input
            value={form.shop}
            onChange={(e) => set("shop")(e.target.value)}
            placeholder="Shop"
            maxLength={200}
            aria-invalid={!!errors.shop}
            className={input(!!errors.shop)}
          />
        </Field>
        <Field
          label="Price"
          errors={errors.bought_for}
          labelClass="sm:sr-only"
          className="sm:w-[120px]"
        >
          <input
            inputMode="decimal"
            value={form.bought_for}
            onChange={(e) => set("bought_for")(e.target.value)}
            placeholder="Price ₱"
            aria-invalid={!!errors.bought_for}
            className={`${input(!!errors.bought_for)} tabular-nums`}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={buttonSecondary}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={buttonPrimary}>
            Save
          </button>
        </div>
      </div>
      {failed && (
        <p role="alert" className="mt-2 text-[13px] leading-[18px] text-loss">
          Couldn’t save the bundle. Check your connection and try again.
        </p>
      )}
    </form>
  );
}

/** “X” and its 3 parts (A, B, C) will be deleted. Render only while open. */
export function DeleteBundleDialog({
  bundle,
  parts,
  onDeleted,
  onClose,
}: {
  bundle: Bundle;
  parts: Part[];
  onDeleted: () => void;
  onClose: () => void;
}) {
  const n = parts.length;
  const its =
    n > 0
      ? ` and its ${n} ${n === 1 ? "part" : "parts"} (${parts.map((p) => p.name).join(", ")})`
      : "";
  return (
    <DeleteDialog
      what="bundle"
      message={`“${bundle.name}”${its} will be deleted. This can’t be undone.`}
      onConfirm={async () => {
        await deleteBundle(bundle.id);
        onDeleted();
      }}
      onClose={onClose}
    />
  );
}
