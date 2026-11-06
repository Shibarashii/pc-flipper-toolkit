import type { BuildsSummary as Summary } from "../api";
import { formatMoney, formatSignedMoney, profitColor } from "../money";
import { Bone, Skeleton } from "./Skeleton";

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

// Shared with the placeholder, so the list doesn't move when the figures arrive. On phones,
// This month is the headline across the top and the other two sit under it; on desktop,
// all three share a row.
const grid = "grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-8";
const cell = "min-w-0 border-t border-line pt-3";
const headline = "col-span-2 sm:col-span-1";
const size = {
  headline: "text-[30px] leading-[36px] sm:text-[22px] sm:leading-[28px]",
  other: "text-[20px] leading-[26px] sm:text-[22px] sm:leading-[28px]",
};

/** The builds list's summary line (docs/specs/builds-summary.md). Every figure comes
 * from the server; null shows a placeholder while it loads. */
export function BuildsSummary({ summary }: { summary: Summary | null }) {
  if (!summary)
    return (
      <Skeleton label="Loading summary" className="mt-6 sm:mt-8">
        <div className={grid}>
          {[true, false, false].map((isHeadline, i) => (
            // Padding, not margins: stacked margins collapse and the cell comes out short.
            <div
              key={i}
              className={`${cell} ${isHeadline ? headline : ""} [&>*]:py-[2px]`}
            >
              <div>
                <Bone className="h-[14px] w-16" />
              </div>
              <div>
                <Bone
                  className={
                    isHeadline
                      ? "h-[32px] w-40 sm:h-[24px] sm:w-28"
                      : "h-[22px] w-24 sm:h-[24px] sm:w-28"
                  }
                />
              </div>
              <div>
                <Bone className="h-[14px] w-12" />
              </div>
            </div>
          ))}
        </div>
      </Skeleton>
    );

  const { this_month, all_time, tied_up } = summary;
  return (
    <section aria-label="Builds summary" className="mt-6 sm:mt-8">
      <dl className={`${grid} tabular-nums`}>
        <Figure
          isHeadline
          label="This month"
          amount={formatSignedMoney(this_month.profit)}
          color={profitColor(this_month.profit)}
          line={`${this_month.sold} sold`}
        />
        <Figure
          label="All time"
          amount={formatSignedMoney(all_time.profit)}
          color={profitColor(all_time.profit)}
          line={`${all_time.sold} sold`}
        />
        <Figure
          label="Tied up"
          amount={formatMoney(tied_up.cost)}
          line={`in ${plural(tied_up.builds, "build", "builds")}`}
        />
      </dl>
    </section>
  );
}

function Figure({
  isHeadline = false,
  label,
  amount,
  color = "",
  line,
}: {
  isHeadline?: boolean;
  label: string;
  amount: string;
  color?: string;
  line: string;
}) {
  return (
    <div className={`${cell} ${isHeadline ? headline : ""}`}>
      <dt className="text-[13px] leading-[18px] font-medium text-muted">
        {label}
      </dt>
      {/* Wraps instead of scrolling when a big amount meets a narrow phone. */}
      <dd
        className={`font-serif font-medium [overflow-wrap:anywhere] ${isHeadline ? size.headline : size.other} ${color}`}
      >
        {amount}
      </dd>
      <dd className="text-[13px] leading-[18px] text-muted">{line}</dd>
    </div>
  );
}
