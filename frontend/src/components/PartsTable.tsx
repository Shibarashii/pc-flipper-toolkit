import { useRef, useState, type SubmitEvent } from "react";
import {
  ApiError,
  CATEGORIES,
  createPart,
  deletePart,
  updatePart,
  type FieldErrors,
  type Part,
  type PartCategory,
  type Totals,
} from "../api";
import { formatMoney } from "../money";
import { buttonPrimary, buttonSecondary, input } from "../ui";
import { cleanMoney, Field, RowActions, Select } from "./form";

const EMPTY = {
  name: "",
  shop: "",
  category: "",
  listed_price: "",
  bought_for: "",
};

/** Which form is open: the add row (maybe with a category picked), a part's id, or none. */
export type PartsOpen = { category: PartCategory | "" } | number | null;

export function PartsTable({
  buildId,
  parts,
  totals,
  open,
  setOpen,
  onChanged,
}: {
  buildId: number;
  parts: Part[];
  totals: Totals;
  // Lifted to the page, so the build checklist's "Add" links can open the add row.
  open: PartsOpen;
  setOpen: (open: PartsOpen) => void;
  onChanged: () => void;
}) {
  // One form at a time: the add row, or the part being edited.
  const adding = open !== null && typeof open === "object" ? open : null;
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const close = () => setOpen(null);

  async function remove(part: Part) {
    setDeleting(part.id);
    setDeleteFailed(false);
    try {
      await deletePart(part.id);
      onChanged();
    } catch {
      setDeleteFailed(true);
    } finally {
      setDeleting(null);
    }
  }

  const n = parts.length;

  return (
    <section aria-labelledby="parts-title">
      <div className="flex items-center gap-3 pb-3">
        <h2
          id="parts-title"
          className="font-serif text-[22px] leading-[28px] font-medium"
        >
          Parts
        </h2>
        <p className="flex-1 text-[13px] leading-[18px] text-muted">
          {n} {n === 1 ? "item" : "items"}
        </p>
        <button
          type="button"
          disabled={adding !== null}
          onClick={() => setOpen({ category: "" })}
          className={buttonSecondary}
        >
          Add part
        </button>
      </div>

      {deleteFailed && (
        <p role="alert" className="pb-3 text-[13px] leading-[18px] text-loss">
          Couldn’t delete the part. Check your connection and try again.
        </p>
      )}

      <div className="flex flex-col border-t border-line-strong">
        {n === 0 && !adding && (
          <div className="py-6">
            <p className="text-[15px] leading-[22px] font-medium">
              No parts yet
            </p>
            <p className="text-[13px] leading-[18px] text-muted">
              Add the first part. Its listed and bought-for prices feed the
              totals.
            </p>
          </div>
        )}

        {n > 0 && (
          <>
            <div
              aria-hidden
              className="hidden gap-4 border-b border-line-strong py-2 text-[13px] leading-[18px] font-medium text-muted sm:flex"
            >
              <span className="flex-1">Part</span>
              <span className="w-[100px]">Category</span>
              <span className="w-[110px] text-right">Listed</span>
              <span className="w-[110px] text-right">Bought for</span>
              <span className="w-[58px]" />
            </div>
            <ul>
              {parts.map((p) =>
                open === p.id ? (
                  <li key={p.id} className="py-3 sm:py-2">
                    <PartForm
                      part={p}
                      buildId={buildId}
                      onSaved={() => {
                        close();
                        onChanged();
                      }}
                      onClose={close}
                    />
                  </li>
                ) : (
                  <PartItem
                    key={p.id}
                    part={p}
                    deleting={deleting === p.id}
                    onEdit={() => setOpen(p.id)}
                    onDelete={() => remove(p)}
                  />
                ),
              )}
            </ul>
          </>
        )}

        {adding && (
          // On mobile the form sits above the list; on desktop it's the row after it.
          <div className="order-first py-3 sm:order-none sm:py-0">
            <PartForm
              // A new category from the checklist starts a fresh form with it picked.
              key={adding.category}
              category={adding.category}
              buildId={buildId}
              onSaved={onChanged}
              onClose={close}
            />
          </div>
        )}

        {n > 0 && (
          <div className="hidden gap-4 border-t border-line-strong py-3 text-[15px] leading-[22px] font-medium tabular-nums sm:flex">
            <span className="flex-1">Total</span>
            <span className="w-[100px]" />
            <span className="w-[110px] text-right text-muted">
              {formatMoney(totals.listed_total)}
            </span>
            <span className="w-[110px] text-right">
              {formatMoney(totals.parts_cost)}
            </span>
            <span className="w-[58px]" />
          </div>
        )}
      </div>
    </section>
  );
}

/** Prices are shown the way they're displayed elsewhere; cleanMoney undoes it on save. */
const fromPart = (p: Part) => ({
  name: p.name,
  shop: p.shop,
  category: p.category as string,
  listed_price: formatMoney(p.listed_price),
  bought_for: formatMoney(p.bought_for),
});

// Desktop layouts differ: adding is one compact row with hidden labels (Figma "Add part
// row"), editing is two labelled rows (Figma "Part row (editing)"). Mobile is the same.
const ADD_LAYOUT = {
  box: "sm:flex-row sm:items-start sm:gap-2 sm:p-2",
  row: "sm:contents",
  label: "sm:sr-only",
  shop: "sm:w-[120px]",
  category: "sm:w-[112px]",
  price: "sm:w-[96px]",
  actions: "sm:contents",
};
const EDIT_LAYOUT = {
  box: "",
  row: "sm:flex-row sm:items-start sm:gap-2",
  label: "",
  shop: "sm:w-[200px]",
  category: "sm:w-[140px]",
  price: "sm:w-[140px]",
  // Clears the label so the buttons line up with the inputs.
  actions: "sm:mt-6 sm:ml-auto sm:gap-1.5",
};

function PartForm({
  part,
  category = "",
  buildId,
  onSaved,
  onClose,
}: {
  /** The part to edit; omit to add a new one. */
  part?: Part;
  /** Preselected when adding. */
  category?: PartCategory | "";
  buildId: number;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(
    part ? fromPart(part) : { ...EMPTY, category },
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const layout = part ? EDIT_LAYOUT : ADD_LAYOUT;
  const title = part ? "Edit part" : "New part";

  const set = (field: keyof typeof EMPTY) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setFailed(false);
    const fields = {
      name: form.name.trim(),
      shop: form.shop.trim(),
      category: form.category as PartCategory,
      listed_price: cleanMoney(form.listed_price),
      bought_for: cleanMoney(form.bought_for),
    };
    try {
      if (part) {
        await updatePart(part.id, fields);
      } else {
        await createPart({ build: buildId, ...fields });
        // Stay open for the next part: people usually enter a whole build at once.
        setForm(EMPTY);
        nameRef.current?.focus();
      }
      onSaved();
    } catch (err) {
      const fieldErrors = err instanceof ApiError ? err.fieldErrors : {};
      setErrors(fieldErrors);
      // Errors on fields this form doesn't show (e.g. "build") need the general message.
      setFailed(!Object.keys(fieldErrors).some((key) => key in EMPTY));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      // Esc drops the draft; an edited row goes back to its saved values.
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      aria-label={part ? `Edit ${part.name}` : title}
    >
      <div
        className={`flex flex-col gap-3 rounded bg-sunken p-3 ${layout.box}`}
      >
        <p className="text-[13px] leading-[18px] font-medium sm:hidden">
          {title}
        </p>
        <div className={`flex flex-col gap-3 ${layout.row}`}>
          <Field
            label="Part"
            errors={errors.name}
            labelClass={layout.label}
            className="sm:flex-1"
          >
            <input
              ref={nameRef}
              autoFocus
              value={form.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="Part name"
              maxLength={200}
              aria-invalid={!!errors.name}
              className={input(!!errors.name)}
            />
          </Field>
          <Field
            label="Shop"
            errors={errors.shop}
            labelClass={layout.label}
            className={layout.shop}
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
        </div>
        <div className={`flex flex-col gap-3 ${layout.row}`}>
          <Field
            label="Category"
            errors={errors.category}
            labelClass={layout.label}
            className={layout.category}
          >
            <Select
              value={form.category}
              onChange={(e) => set("category")(e.target.value)}
              error={!!errors.category}
              className={form.category ? "" : "text-faint"}
            >
              <option value="" disabled>
                Category
              </option>
              {Object.entries(CATEGORIES).map(([value, label]) => (
                <option key={value} value={value} className="text-ink">
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex gap-3 sm:contents">
            <Field
              label="Listed price"
              errors={errors.listed_price}
              labelClass={layout.label}
              className={`flex-1 sm:flex-none ${layout.price}`}
            >
              <input
                inputMode="decimal"
                value={form.listed_price}
                onChange={(e) => set("listed_price")(e.target.value)}
                placeholder="Listed ₱"
                aria-invalid={!!errors.listed_price}
                className={`${input(!!errors.listed_price)} tabular-nums`}
              />
            </Field>
            <Field
              label="Bought for"
              errors={errors.bought_for}
              labelClass={layout.label}
              className={`flex-1 sm:flex-none ${layout.price}`}
            >
              <input
                inputMode="decimal"
                value={form.bought_for}
                onChange={(e) => set("bought_for")(e.target.value)}
                placeholder="Bought ₱"
                aria-invalid={!!errors.bought_for}
                className={`${input(!!errors.bought_for)} tabular-nums`}
              />
            </Field>
          </div>
          <div className={`flex justify-end gap-2 ${layout.actions}`}>
            <button type="button" onClick={onClose} className={buttonSecondary}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={buttonPrimary}>
              {part ? (
                "Save"
              ) : (
                <>
                  <span className="sm:hidden">Add part</span>
                  <span className="hidden sm:inline">Save</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      {failed && (
        <p role="alert" className="mt-2 text-[13px] leading-[18px] text-loss">
          Couldn’t save the part. Check your connection and try again.
        </p>
      )}
    </form>
  );
}

function PartItem({
  part,
  deleting,
  onEdit,
  onDelete,
}: {
  part: Part;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const category = CATEGORIES[part.category];
  const actions = (
    <RowActions
      name={part.name}
      deleting={deleting}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
  return (
    <li className="border-b border-line py-3.5 sm:py-3">
      {/* Mobile card */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] leading-[22px] font-medium">
              {part.name}
            </p>
            <p className="text-[13px] leading-[18px] text-muted">
              {[category, part.shop].filter(Boolean).join(" · ")}
            </p>
          </div>
          {actions}
        </div>
        <div className="flex gap-3 tabular-nums">
          <div className="flex-1 text-muted">
            <p className="text-[13px] leading-[18px]">Listed</p>
            <p className="text-[15px] leading-[22px]">
              {formatMoney(part.listed_price)}
            </p>
          </div>
          <div className="flex-1">
            <p className="text-[13px] leading-[18px] text-muted">Bought for</p>
            <p className="text-[15px] leading-[22px] font-medium">
              {formatMoney(part.bought_for)}
            </p>
          </div>
        </div>
      </div>

      {/* Desktop row */}
      <div className="hidden items-center gap-4 sm:flex">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-[22px] font-medium">{part.name}</p>
          {part.shop && (
            <p className="text-[13px] leading-[18px] text-muted">{part.shop}</p>
          )}
        </div>
        <span className="w-[100px] text-[13px] leading-[18px] text-muted">
          {category}
        </span>
        <span className="w-[110px] text-right text-[15px] leading-[22px] text-muted tabular-nums">
          {formatMoney(part.listed_price)}
        </span>
        <span className="w-[110px] text-right text-[15px] leading-[22px] font-medium tabular-nums">
          {formatMoney(part.bought_for)}
        </span>
        {actions}
      </div>
    </li>
  );
}
