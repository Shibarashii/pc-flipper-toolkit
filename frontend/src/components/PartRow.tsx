import { useId, useRef, useState, type SubmitEvent } from "react";
import {
  CATEGORIES,
  createPart,
  type Bundle,
  updatePart,
  type Part,
  type PartCategory,
  type ShopProduct,
} from "../api";
import { formatMoney } from "../money";
import { buttonPrimary, buttonSecondary, input } from "../ui";
import { cleanMoney, Field, RowActions, Select, useSave } from "./form";
import { PartSearch } from "./PartSearch";
import { PriceLookup } from "./PriceLookup";

const EMPTY = {
  name: "",
  shop: "",
  category: "",
  listed_price: "",
  bought_for: "",
  bundle: "",
};

/** Prices are shown the way they're displayed elsewhere; cleanMoney undoes it on save. */
const fromPart = (p: Part) => ({
  name: p.name,
  shop: p.shop,
  category: p.category as string,
  listed_price: formatMoney(p.listed_price),
  bought_for: p.bought_for === null ? "" : formatMoney(p.bought_for),
  bundle: p.bundle === null ? "" : String(p.bundle),
});

/** What a shop's product fills in; nothing is saved until Save. */
const fromProduct = (p: ShopProduct) => ({
  listed_price: formatMoney(p.price),
  shop: p.shop,
});

// Two labelled rows on desktop, for adding and editing alike: a one-line add row left too
// little room for a part's name and price.
const ROW =
  "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:gap-2";

export function PartForm({
  part,
  category = "",
  bundle,
  bundles,
  buildId,
  onSaved,
  onClose,
}: {
  /** The part to edit; omit to add a new one. */
  part?: Part;
  /** Preselected when adding. */
  category?: PartCategory | "";
  /** Adding inside this bundle (from its "Add part"). */
  bundle?: number;
  /** The build's bundles, for the Bundle select. */
  bundles: Bundle[];
  buildId: number;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(
    part
      ? fromPart(part)
      : { ...EMPTY, category, bundle: String(bundle ?? "") },
  );
  const { errors, failed, saving, save } = useSave(EMPTY);
  const nameRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const findRef = useRef<HTMLButtonElement>(null);
  // The part's name when "Find prices" opened the lookup; null while it's closed.
  const [lookup, setLookup] = useState<string | null>(null);
  const lookupId = useId();
  const full = part !== undefined || bundle !== undefined;
  const title = part ? "Edit part" : "New part";

  const set = (field: keyof typeof EMPTY) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  function closeLookup() {
    setLookup(null);
    findRef.current?.focus();
  }

  function pick(product: ShopProduct) {
    setForm((f) => ({ ...f, ...fromProduct(product) }));
    setLookup(null);
    priceRef.current?.focus();
  }

  /** Like pick, plus the name; the focus stays in Part, so the name can be trimmed. */
  function pickFromPartSearch(product: ShopProduct) {
    setForm((f) => ({
      ...f,
      name: product.short_title,
      ...fromProduct(product),
    }));
    setLookup(null);
  }

  function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const fields = {
      name: form.name.trim(),
      shop: form.shop.trim(),
      category: form.category as PartCategory,
      listed_price: cleanMoney(form.listed_price),
      // Blank is null: allowed inside a bundle, and the server says so otherwise.
      bought_for: cleanMoney(form.bought_for) || null,
      bundle: form.bundle ? Number(form.bundle) : null,
    };
    save(async () => {
      if (part) {
        await updatePart(part.id, fields);
      } else {
        await createPart({ build: buildId, ...fields });
        // Stay open for the next part: people usually enter a whole build at once.
        setForm({ ...EMPTY, bundle: form.bundle });
        setLookup(null);
        nameRef.current?.focus();
      }
      onSaved();
    });
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      // Esc drops the draft; an edited row goes back to its saved values.
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      aria-label={part ? `Edit ${part.name}` : title}
    >
      <div className="rounded bg-sunken">
        <div className="flex flex-col gap-3 p-3">
          <p className="text-[13px] leading-[18px] font-medium sm:hidden">
            {title}
          </p>
          <div className={ROW}>
            <PartSearch
              value={form.name}
              onChange={set("name")}
              onPick={pickFromPartSearch}
              inputRef={nameRef}
              errors={errors.name}
              className="sm:flex-1"
            />
            <Field label="Shop" errors={errors.shop} className="sm:w-[200px]">
              <input
                value={form.shop}
                onChange={(e) => set("shop")(e.target.value)}
                placeholder="Shop"
                maxLength={200}
                aria-invalid={!!errors.shop}
                className={input(!!errors.shop)}
              />
            </Field>
            {full && bundles.length > 0 && (
              <Field
                label="Bundle"
                errors={errors.bundle}
                className="sm:w-[200px]"
              >
                <Select
                  value={form.bundle}
                  onChange={(e) => set("bundle")(e.target.value)}
                  error={!!errors.bundle}
                >
                  <option value="">None</option>
                  {bundles.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
          <div className={ROW}>
            <Field
              label="Category"
              errors={errors.category}
              className="sm:w-[140px]"
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
                className="flex-1 sm:w-[140px] sm:flex-none"
              >
                <input
                  ref={priceRef}
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
                className="flex-1 sm:w-[140px] sm:flex-none"
              >
                <input
                  inputMode="decimal"
                  value={form.bought_for}
                  onChange={(e) => set("bought_for")(e.target.value)}
                  // Inside a bundle it's an optional share of the bundle's price.
                  placeholder={form.bundle ? "Optional" : "Bought ₱"}
                  aria-invalid={!!errors.bought_for}
                  className={`${input(!!errors.bought_for)} tabular-nums`}
                />
              </Field>
            </div>
            <div // Clears the label so the buttons line up with the inputs.
              className="flex justify-end gap-2 sm:mt-6 sm:ml-auto sm:gap-1.5"
            >
              <button
                type="button"
                onClick={onClose}
                className={buttonSecondary}
              >
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
        {/* Inside the box, on its own strip, so it reads as part of the form. */}
        <div className="border-t border-line p-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              ref={findRef}
              type="button"
              aria-expanded={lookup !== null}
              aria-controls={lookup !== null ? lookupId : undefined}
              onClick={() =>
                lookup === null ? setLookup(form.name) : closeLookup()
              }
              className={`inline-flex items-center gap-1.5 ${buttonSecondary}`}
            >
              <svg
                aria-hidden
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
              >
                <circle cx="7" cy="7" r="4.75" />
                <path d="m10.5 10.5 3.5 3.5" />
              </svg>
              Find prices
            </button>
            {lookup === null && (
              <p className="text-[13px] leading-[18px] text-muted">
                Fill in the price and shop from EasyPC or PC Express.
              </p>
            )}
          </div>
          {lookup !== null && (
            <div className="mt-3">
              <PriceLookup
                id={lookupId}
                initialQuery={lookup}
                onPick={pick}
                onClose={closeLookup}
              />
            </div>
          )}
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

export function PartItem({
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
            <p
              className={`text-[15px] leading-[22px] font-medium ${part.bought_for === null ? "text-faint" : ""}`}
            >
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
        <span
          className={`w-[110px] text-right text-[15px] leading-[22px] font-medium tabular-nums ${part.bought_for === null ? "text-faint" : ""}`}
        >
          {formatMoney(part.bought_for)}
        </span>
        {actions}
      </div>
    </li>
  );
}
