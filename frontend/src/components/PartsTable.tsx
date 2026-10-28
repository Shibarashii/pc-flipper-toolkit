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
import { BundleForm, BundleItem, DeleteBundleDialog } from "./BundleRow";
import { PartForm, PartItem } from "./PartRow";

/** Which form is open (one at a time), or null. */
export type PartsOpen =
  // The add-part row, maybe with a category picked, or inside a bundle.
  | { category: PartCategory | ""; bundle?: number }
  // The add-bundle row, or the bundle being edited.
  | { bundleForm: number | "new" }
  // The part being edited.
  | number
  | null;

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
  const adding =
    open !== null && typeof open === "object" && "category" in open
      ? open
      : null;
  const bundleForm =
    open !== null && typeof open === "object" && "bundleForm" in open
      ? open.bundleForm
      : null;
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [confirming, setConfirming] = useState<Bundle | null>(null);
  const close = () => setOpen(null);
  const saved = () => {
    close();
    onChanged();
  };

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
          bundles={bundles}
          buildId={buildId}
          onSaved={saved}
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

  const addPartForm = adding && (
    <PartForm
      // A new category from the checklist starts a fresh form with it picked.
      key={`${adding.category}-${adding.bundle}`}
      category={adding.category}
      bundle={adding.bundle}
      bundles={bundles}
      buildId={buildId}
      onSaved={onChanged}
      onClose={close}
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
          disabled={bundleForm === "new"}
          onClick={() => setOpen({ bundleForm: "new" })}
          className={buttonSecondary}
        >
          Add bundle
        </button>
        <button
          type="button"
          disabled={adding !== null && adding.bundle === undefined}
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
        {!any && !adding && bundleForm === null && (
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
                    {bundleForm === b.id ? (
                      <div className="py-3 sm:py-2">
                        <BundleForm
                          bundle={b}
                          buildId={buildId}
                          onSaved={saved}
                          onClose={close}
                        />
                      </div>
                    ) : (
                      <BundleItem
                        bundle={b}
                        count={inside.length}
                        deleting={confirming?.id === b.id}
                        onAddPart={() =>
                          setOpen({ category: "", bundle: b.id })
                        }
                        onEdit={() => setOpen({ bundleForm: b.id })}
                        onDelete={() => setConfirming(b)}
                      />
                    )}
                    <ul
                      aria-label={`Parts in ${b.name}`}
                      className="pl-4 sm:pl-6"
                    >
                      {inside.map(renderPart)}
                    </ul>
                    {adding?.bundle === b.id && (
                      <div className="py-3 pl-4 sm:py-2 sm:pl-6">
                        {addPartForm}
                      </div>
                    )}
                  </li>
                );
              })}
              {parts.filter((p) => p.bundle === null).map(renderPart)}
            </ul>
          </>
        )}

        {/* On mobile these sit above the list; on desktop they're the row after it. */}
        {adding && adding.bundle === undefined && (
          <div className="order-first py-3 sm:order-none sm:py-0">
            {addPartForm}
          </div>
        )}
        {bundleForm === "new" && (
          <div className="order-first py-3 sm:order-none sm:py-0">
            <BundleForm buildId={buildId} onSaved={saved} onClose={close} />
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

      {confirming && (
        <DeleteBundleDialog
          bundle={confirming}
          parts={parts.filter((p) => p.bundle === confirming.id)}
          onDeleted={() => {
            setConfirming(null);
            onChanged();
          }}
          onClose={() => setConfirming(null)}
        />
      )}
    </section>
  );
}
