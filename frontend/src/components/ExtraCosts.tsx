import { useRef, useState, type SubmitEvent } from "react";
import {
  createExtraCost,
  deleteExtraCost,
  updateExtraCost,
  type ExtraCost,
} from "../api";
import { formatMoney } from "../money";
import { buttonPrimary, buttonSecondary, input } from "../ui";
import { cleanMoney, Field, RowActions, useSave } from "./form";

const EMPTY = { label: "", amount: "" };

export function ExtraCosts({
  buildId,
  costs,
  total,
  onChanged,
}: {
  buildId: number;
  costs: ExtraCost[];
  total: string;
  onChanged: () => void;
}) {
  // One form at a time: the add row, or the cost being edited.
  const [open, setOpen] = useState<"new" | number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const close = () => setOpen(null);

  async function remove(cost: ExtraCost) {
    setDeleting(cost.id);
    setDeleteFailed(false);
    try {
      await deleteExtraCost(cost.id);
      onChanged();
    } catch {
      setDeleteFailed(true);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section aria-labelledby="extra-costs-title">
      <div className="flex items-center gap-3 pb-3">
        <h2
          id="extra-costs-title"
          className="font-serif text-[22px] leading-[28px] font-medium"
        >
          Extra costs
        </h2>
        <p className="flex-1 text-[13px] leading-[18px] text-muted tabular-nums">
          {costs.length > 0 && `${formatMoney(total)} total`}
        </p>
        <button
          type="button"
          disabled={open === "new"}
          onClick={() => setOpen("new")}
          className={buttonSecondary}
        >
          Add cost
        </button>
      </div>

      {deleteFailed && (
        <p role="alert" className="pb-3 text-[13px] leading-[18px] text-loss">
          Couldn’t delete the cost. Check your connection and try again.
        </p>
      )}

      <div className="border-t border-line-strong">
        {costs.length === 0 && open !== "new" && (
          <div className="py-6">
            <p className="text-[15px] leading-[22px] font-medium">
              No extra costs yet
            </p>
            <p className="text-[13px] leading-[18px] text-muted">
              Shipping, platform fees, thermal paste, cables — anything that
              isn’t a part.
            </p>
          </div>
        )}

        <ul>
          {costs.map((c) =>
            open === c.id ? (
              <li key={c.id} className="py-3">
                <CostForm
                  cost={c}
                  buildId={buildId}
                  onSaved={() => {
                    close();
                    onChanged();
                  }}
                  onClose={close}
                />
              </li>
            ) : (
              <li
                key={c.id}
                className="flex items-center gap-4 border-b border-line py-2 text-[15px] leading-[22px]"
              >
                <span className="min-w-0 flex-1">{c.label}</span>
                <span className="tabular-nums">{formatMoney(c.amount)}</span>
                <RowActions
                  name={c.label}
                  deleting={deleting === c.id}
                  onEdit={() => setOpen(c.id)}
                  onDelete={() => remove(c)}
                />
              </li>
            ),
          )}
        </ul>

        {open === "new" && (
          <div className="py-3">
            <CostForm buildId={buildId} onSaved={onChanged} onClose={close} />
          </div>
        )}
      </div>
    </section>
  );
}

function CostForm({
  cost,
  buildId,
  onSaved,
  onClose,
}: {
  /** The cost to edit; omit to add a new one. */
  cost?: ExtraCost;
  buildId: number;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(
    cost ? { label: cost.label, amount: formatMoney(cost.amount) } : EMPTY,
  );
  const { errors, failed, saving, save } = useSave(EMPTY);
  const labelRef = useRef<HTMLInputElement>(null);

  function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const fields = {
      label: form.label.trim(),
      amount: cleanMoney(form.amount),
    };
    save(async () => {
      if (cost) {
        await updateExtraCost(cost.id, fields);
      } else {
        await createExtraCost({ build: buildId, ...fields });
        // Stay open for the next cost, as with parts.
        setForm(EMPTY);
        labelRef.current?.focus();
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
      aria-label={cost ? `Edit ${cost.label}` : "New cost"}
    >
      <div className="flex flex-col gap-3 rounded bg-sunken p-3">
        <div className="flex items-start gap-3">
          <Field label="Label" errors={errors.label} className="min-w-0 flex-1">
            <input
              ref={labelRef}
              autoFocus
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Shipping"
              maxLength={200}
              aria-invalid={!!errors.label}
              className={input(!!errors.label)}
            />
          </Field>
          <Field label="Amount" errors={errors.amount} className="w-[120px]">
            <input
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="₱0.00"
              aria-invalid={!!errors.amount}
              className={`${input(!!errors.amount)} tabular-nums`}
            />
          </Field>
        </div>
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
          Couldn’t save the cost. Check your connection and try again.
        </p>
      )}
    </form>
  );
}
