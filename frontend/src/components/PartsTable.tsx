import { useRef, useState, type ReactNode, type SubmitEvent } from "react";
import {
  ApiError,
  CATEGORIES,
  createPart,
  type FieldErrors,
  type Part,
  type PartCategory,
  type Totals,
} from "../api";
import chevron from "../assets/chevron.svg";
import { formatMoney } from "../money";
import { buttonPrimary, buttonSecondary, input } from "../ui";

const EMPTY = {
  name: "",
  shop: "",
  category: "",
  listed_price: "",
  bought_for: "",
};

/** "12,500" → "12500": people type thousands separators; the API doesn't accept them. */
const cleanMoney = (value: string) => value.replace(/,/g, "").trim();

export function PartsTable({
  buildId,
  parts,
  totals,
  onChanged,
}: {
  buildId: number;
  parts: Part[];
  totals: Totals;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const set = (field: keyof typeof EMPTY) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  function close() {
    setAdding(false);
    setForm(EMPTY);
    setErrors({});
    setFailed(false);
  }

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setFailed(false);
    try {
      await createPart({
        build: buildId,
        name: form.name.trim(),
        shop: form.shop.trim(),
        category: form.category as PartCategory,
        listed_price: cleanMoney(form.listed_price),
        bought_for: cleanMoney(form.bought_for),
      });
      // Stay open for the next part: people usually enter a whole build at once.
      setForm(EMPTY);
      nameRef.current?.focus();
      onChanged();
    } catch (err) {
      const fieldErrors = err instanceof ApiError ? err.fieldErrors : {};
      setErrors(fieldErrors);
      setFailed(Object.keys(fieldErrors).length === 0);
    } finally {
      setSaving(false);
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
          disabled={adding}
          onClick={() => setAdding(true)}
          className={buttonSecondary}
        >
          Add part
        </button>
      </div>

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
              {parts.map((p) => (
                <PartItem key={p.id} part={p} />
              ))}
            </ul>
          </>
        )}

        {adding && (
          // On mobile the form sits above the list; on desktop it's the row after it.
          <form
            noValidate
            onSubmit={submit}
            onKeyDown={(e) => e.key === "Escape" && close()}
            aria-label="New part"
            className="order-first py-3 sm:order-none sm:py-0"
          >
            <div className="flex flex-col gap-3 rounded bg-sunken p-3 sm:flex-row sm:items-start sm:gap-2 sm:p-2">
              <p className="text-[13px] leading-[18px] font-medium sm:hidden">
                New part
              </p>
              <Field label="Part" errors={errors.name} className="sm:flex-1">
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
              <Field label="Shop" errors={errors.shop} className="sm:w-[120px]">
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
                label="Category"
                errors={errors.category}
                className="sm:w-[112px]"
              >
                <div className="relative">
                  <select
                    value={form.category}
                    onChange={(e) => set("category")(e.target.value)}
                    aria-invalid={!!errors.category}
                    className={`${input(!!errors.category)} appearance-none pr-8 ${form.category ? "" : "text-faint"}`}
                  >
                    <option value="" disabled>
                      Category
                    </option>
                    {Object.entries(CATEGORIES).map(([value, label]) => (
                      <option key={value} value={value} className="text-ink">
                        {label}
                      </option>
                    ))}
                  </select>
                  <img
                    src={chevron}
                    alt=""
                    width={16}
                    height={16}
                    className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2"
                  />
                </div>
              </Field>
              <div className="flex gap-3 sm:contents">
                <Field
                  label="Listed price"
                  errors={errors.listed_price}
                  className="flex-1 sm:w-[96px] sm:flex-none"
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
                  className="flex-1 sm:w-[96px] sm:flex-none"
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
              <div className="flex justify-end gap-2 sm:contents">
                <button
                  type="button"
                  onClick={close}
                  className={`${buttonSecondary} sm:hidden`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={buttonPrimary}
                >
                  <span className="sm:hidden">Add part</span>
                  <span className="hidden sm:inline">Save</span>
                </button>
              </div>
            </div>
            {failed && (
              <p
                role="alert"
                className="mt-2 text-[13px] leading-[18px] text-loss"
              >
                Couldn’t save the part. Check your connection and try again.
              </p>
            )}
          </form>
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

function PartItem({ part }: { part: Part }) {
  const category = CATEGORIES[part.category];
  return (
    <li className="border-b border-line py-3.5 hover:bg-sunken sm:py-3">
      {/* Mobile card */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div>
          <p className="text-[15px] leading-[22px] font-medium">{part.name}</p>
          <p className="text-[13px] leading-[18px] text-muted">
            {[category, part.shop].filter(Boolean).join(" · ")}
          </p>
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
        {/* Edit / delete actions arrive in T5. */}
        <span className="w-[58px]" />
      </div>
    </li>
  );
}

function Field({
  label,
  errors,
  className = "",
  children,
}: {
  label: string;
  errors?: string[];
  className?: string;
  children: ReactNode;
}) {
  // Errors sit outside the <label> so they aren't read as part of the field's name.
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] leading-[18px] font-medium text-muted sm:sr-only">
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
