import { useState } from "react";
import {
  deletePart,
  type Bundle,
  type Part,
  type PartCategory,
  type Totals,
} from "../api";
import { formatMoney } from "../money";
import { buttonSecondary } from "../ui";
import { BundleItem, PartForm, PartItem } from "./PartRow";

/** Which form is open: the add row (maybe with a category picked), a part's id, or none. */
export type PartsOpen = { category: PartCategory | "" } | number | null;

export function PartsTable({
  buildId,
  parts,
  bundles,
  totals,
  open,
  setOpen,
  onChanged,
}: {
  buildId: number;
  parts: Part[];
  bundles: Bundle[];
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
  const any = n > 0 || bundles.length > 0;

  const renderPart = (p: Part) =>
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
    );

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
        {!any && !adding && (
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

        {any && (
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
              {/* Bundles first, each with its parts indented under it. */}
              {bundles.map((b) => {
                const inside = parts.filter((p) => p.bundle === b.id);
                return (
                  <li key={`bundle-${b.id}`}>
                    <BundleItem bundle={b} count={inside.length} />
                    <ul
                      aria-label={`Parts in ${b.name}`}
                      className="pl-4 sm:pl-6"
                    >
                      {inside.map(renderPart)}
                    </ul>
                  </li>
                );
              })}
              {parts.filter((p) => p.bundle === null).map(renderPart)}
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

        {any && (
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
