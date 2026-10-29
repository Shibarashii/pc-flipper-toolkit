import { useRef, useState, type KeyboardEvent } from "react";
import {
  ApiError,
  updateBuild,
  type BuildDetail,
  type BuildPatch,
  type BuildStatus,
  type FieldErrors,
} from "../api";
import { buildNo } from "../buildNo";
import { formatMoney } from "../money";
import { buttonDanger, input } from "../ui";
import { DeleteBuildDialog } from "./DeleteBuildDialog";
import {
  cleanMoney,
  Field,
  IconButton,
  SaveStatus,
  Select,
  type SaveState,
} from "./form";
import { StatusTag } from "./StatusTag";

const STATUSES: Record<BuildStatus, string> = {
  planning: "Planning",
  building: "Building",
  listed: "Listed",
  sold: "Sold",
};

/** Today in the browser's time zone, as the API's "YYYY-MM-DD". */
const today = () => new Date().toLocaleDateString("en-CA");

/** "2026-10-18" → "Oct 18, 2026". Parsed as a local date, so it never shifts a day. */
const formatDate = (date: string) =>
  new Date(`${date}T00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const priceText = (price: string | null) =>
  price === null ? "" : formatMoney(price);

/** Enter saves (by blurring, so blur is the one save path); Esc restores the saved
 * value, so the blur that follows has nothing to save. */
const saveKeys =
  (restore: () => void) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
    if (e.key === "Escape") restore();
  };

/** Removes one field's messages, e.g. once Esc puts back its saved value. */
const without = (errors: FieldErrors, field: string) =>
  Object.fromEntries(Object.entries(errors).filter(([key]) => key !== field));

export function BuildHeader({
  build,
  onUpdated,
}: {
  build: BuildDetail;
  /** Called with the saved build (the PATCH response, totals included). */
  onUpdated: (build: BuildDetail) => void;
}) {
  // Shown while a save is in flight, so a select doesn't snap back to the old value.
  const [pending, setPending] = useState<BuildPatch>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [name, setName] = useState(build.name);
  // Esc closes the rename input; some browsers then fire blur, which must not save.
  const renameCancelled = useRef(false);
  const [price, setPrice] = useState(priceText(build.selling_price));
  const [soldAt, setSoldAt] = useState(build.sold_at ?? "");
  const shown = { ...build, ...pending };

  async function save(patch: BuildPatch) {
    setPending(patch);
    setErrors({});
    setSaveState("saving");
    try {
      onUpdated(await updateBuild(build.id, patch));
      setSaveState("saved");
      return true;
    } catch (err) {
      const fieldErrors = err instanceof ApiError ? err.fieldErrors : {};
      setErrors(fieldErrors);
      // A field error is shown under its field; anything else needs the general message.
      setSaveState(Object.keys(fieldErrors).length > 0 ? "idle" : "failed");
      return false;
    } finally {
      setPending({});
    }
  }

  async function changeStatus(status: BuildStatus) {
    // Switching to Sold fills in today (editable); switching away clears it.
    const sold_at = status === "sold" ? (build.sold_at ?? today()) : null;
    setSoldAt(sold_at ?? "");
    // On failure the build keeps its date; the draft must too, or a later blur saves "".
    if (!(await save({ status, sold_at }))) setSoldAt(build.sold_at ?? "");
  }

  async function saveName() {
    if (renameCancelled.current) return;
    const trimmed = name.trim();
    if (trimmed && trimmed !== build.name) {
      if (!(await save({ name: trimmed }))) return;
    }
    setName(trimmed || build.name);
    setRenaming(false);
  }

  async function savePrice() {
    const value = cleanMoney(price) || null;
    const unchanged =
      value === null
        ? build.selling_price === null
        : build.selling_price !== null &&
          Number(value) === Number(build.selling_price);
    if (unchanged) return setPrice(priceText(build.selling_price));
    if (await save({ selling_price: value })) setPrice(priceText(value));
  }

  function saveSoldAt() {
    if ((soldAt || null) !== build.sold_at) save({ sold_at: soldAt || null });
  }

  return (
    <div>
      <div className="mt-2.5 flex items-center gap-2.5 pt-2">
        <StatusTag status={shown.status} />
        <span className="text-[13px] leading-[18px] text-muted">
          Build {buildNo(build.number)}
          {shown.status === "sold" &&
            shown.sold_at &&
            ` · sold ${formatDate(shown.sold_at)}`}
        </span>
      </div>

      {renaming ? (
        <div className="mt-2.5">
          <input
            autoFocus
            aria-label="Build name"
            value={name}
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                renameCancelled.current = true;
                setName(build.name);
                setRenaming(false);
              }
            }}
            aria-invalid={!!errors.name}
            className={`${input(!!errors.name)} py-0 font-serif text-[40px] leading-[52px] font-medium tracking-[-0.01em]`}
          />
          {errors.name?.map((message) => (
            <p key={message} className="mt-1.5 text-[13px] text-loss">
              {message}
            </p>
          ))}
        </div>
      ) : (
        <div className="mt-2.5 flex items-start gap-2">
          <h1 className="min-w-0 font-serif text-[40px] leading-[44px] font-medium tracking-[-0.01em] break-words">
            {shown.name}
          </h1>
          <div className="mt-2 shrink-0">
            <IconButton
              action="edit"
              label="Rename build"
              onClick={() => {
                renameCancelled.current = false;
                setRenaming(true);
              }}
            />
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-start">
          <Field label="Status" errors={errors.status} className="sm:w-[200px]">
            <Select
              value={shown.status}
              onChange={(e) => changeStatus(e.target.value as BuildStatus)}
              error={!!errors.status}
            >
              {Object.entries(STATUSES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Selling price"
            errors={errors.selling_price}
            className="sm:w-[200px]"
          >
            <input
              inputMode="decimal"
              value={price}
              placeholder="₱0.00"
              onChange={(e) => setPrice(e.target.value)}
              onBlur={savePrice}
              onKeyDown={saveKeys(() => {
                setPrice(priceText(build.selling_price));
                setErrors((e) => without(e, "selling_price"));
              })}
              aria-invalid={!!errors.selling_price}
              className={`${input(!!errors.selling_price)} tabular-nums`}
            />
          </Field>
          {shown.status === "sold" && (
            <Field
              label="Sold on"
              errors={errors.sold_at}
              className="col-span-2 sm:w-[200px]"
            >
              <input
                type="date"
                value={soldAt}
                onChange={(e) => setSoldAt(e.target.value)}
                onBlur={saveSoldAt}
                onKeyDown={saveKeys(() => {
                  setSoldAt(build.sold_at ?? "");
                  setErrors((e) => without(e, "sold_at"));
                })}
                aria-invalid={!!errors.sold_at}
                className={input(!!errors.sold_at)}
              />
            </Field>
          )}
          {/* Beside the fields on desktop, centred on the inputs; its own line on mobile. */}
          <SaveStatus
            state={saveState}
            className={`col-span-2 sm:self-end sm:pb-[11px] ${saveState === "idle" ? "hidden sm:block" : ""}`}
          />
        </div>
        {/* Lines up with the inputs' bottom edge, even when a field shows an error. */}
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className={`shrink-0 self-end ${buttonDanger}`}
        >
          Delete build
        </button>
      </div>
      {confirmingDelete && (
        <DeleteBuildDialog
          build={build}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
