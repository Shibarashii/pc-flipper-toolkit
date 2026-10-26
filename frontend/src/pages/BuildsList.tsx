import { useEffect, useState } from "react";
import { Link } from "react-router";
import { listBuilds, type Build } from "../api";
import { buildNo } from "../buildNo";
import { NewBuildDialog } from "../components/NewBuildDialog";
import { StatusTag } from "../components/StatusTag";
import { formatMoney, formatSignedMoney, profitColor } from "../money";
import { buttonPrimary } from "../ui";

// Insets the first and last columns, so text doesn't touch the hovered row's edges.
const edgeCells = "[&>:first-child]:pl-3 [&>:last-child]:pr-3";

export function BuildsList() {
  const [builds, setBuilds] = useState<Build[] | null>(null);
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listBuilds().then(setBuilds, () => setError(true));
  }, []);

  let subtitle = "";
  if (builds) {
    const sold = builds.filter((b) => b.status === "sold").length;
    const n = builds.length;
    subtitle = `${n} ${n === 1 ? "build" : "builds"} · ${sold} sold`;
  } else if (!error) {
    subtitle = "Loading…";
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pt-7 pb-10 sm:px-8 sm:pt-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[40px] leading-[44px] font-medium tracking-[-0.01em]">
            Builds
          </h1>
          <p className="mt-1.5 min-h-[18px] text-[13px] text-muted">
            {subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className={`shrink-0 ${buttonPrimary}`}
        >
          New build
        </button>
      </div>
      {creating && <NewBuildDialog onClose={() => setCreating(false)} />}

      {error && (
        <div
          role="alert"
          className="mt-8 rounded border border-loss bg-surface px-4 py-3"
        >
          <p className="font-medium text-loss">Couldn’t load builds</p>
          <p className="text-[13px] text-muted">
            The server didn’t respond. Check that it’s running and reload.
          </p>
        </div>
      )}

      {builds?.length === 0 && (
        <div className="mt-8 border-t border-line-strong py-20 text-center">
          <h2 className="font-serif text-[22px] font-medium">No builds yet</h2>
          <p className="mx-auto mt-1 max-w-md text-muted">
            Create a build for each PC you flip. Add its parts and extra costs,
            and the profit works itself out.
          </p>
        </div>
      )}

      {builds && builds.length > 0 && (
        <>
          {/* Desktop table */}
          <table className="mt-8 hidden w-full border-t border-line-strong text-[15px] tabular-nums sm:table">
            <thead>
              <tr
                className={`border-b border-line-strong text-left text-[13px] font-medium text-muted ${edgeCells}`}
              >
                <th className="w-12 py-2 font-medium">No.</th>
                <th className="py-2 font-medium">Build</th>
                <th className="w-[110px] py-2 font-medium">Status</th>
                <th className="w-[130px] py-2 text-right font-medium">
                  Total cost
                </th>
                <th className="w-[130px] py-2 text-right font-medium">
                  Selling price
                </th>
                <th className="w-[130px] py-2 text-right font-medium">
                  Profit
                </th>
              </tr>
            </thead>
            <tbody>
              {builds.map((b) => (
                <tr
                  key={b.id}
                  className={`relative border-b border-line hover:bg-sunken ${edgeCells}`}
                >
                  <td className="py-3.5 text-[13px] text-faint">
                    {buildNo(b.id)}
                  </td>
                  <td className="py-3.5 font-medium">
                    <Link
                      to={`/builds/${b.id}`}
                      className="after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {b.name}
                    </Link>
                  </td>
                  <td className="py-3.5">
                    <StatusTag status={b.status} />
                  </td>
                  <td className="py-3.5 text-right">
                    {formatMoney(b.totals.total_cost)}
                  </td>
                  <td
                    className={`py-3.5 text-right ${b.selling_price === null ? "text-faint" : ""}`}
                  >
                    {formatMoney(b.selling_price)}
                  </td>
                  <td
                    className={`py-3.5 text-right font-medium ${profitColor(b.totals.profit)}`}
                  >
                    {formatSignedMoney(b.totals.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile cards */}
          <ul className="mt-6 border-t border-line-strong sm:hidden">
            {builds.map((b) => (
              <li key={b.id} className="relative border-b border-line py-4">
                <div className="flex items-center gap-3">
                  <Link
                    to={`/builds/${b.id}`}
                    className="flex-1 font-medium after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {b.name}
                  </Link>
                  <StatusTag status={b.status} />
                </div>
                <dl className="mt-2.5 grid grid-cols-3 gap-3 tabular-nums">
                  <Stat label="Cost" value={formatMoney(b.totals.total_cost)} />
                  <Stat
                    label="Selling"
                    value={formatMoney(b.selling_price)}
                    className={b.selling_price === null ? "text-faint" : ""}
                  />
                  <Stat
                    label="Profit"
                    value={formatSignedMoney(b.totals.profit)}
                    className={`font-medium ${profitColor(b.totals.profit)}`}
                  />
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] leading-[18px] text-muted">{label}</dt>
      <dd className={`text-[15px] leading-[22px] ${className}`}>{value}</dd>
    </div>
  );
}
