import type { BuildsSummary as Summary } from "../api";
import { formatMoney, formatSignedMoney, profitColor } from "../money";
import { Bone, Skeleton } from "./Skeleton";

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

// The cell's lines, shared with the placeholder so the table doesn't move when it loads.
const cell = "min-w-0 border-t border-line pt-3";
const amountSize =
  "text-[15px] leading-[22px] sm:text-[22px] sm:leading-[28px]";

/** The builds list's summary line (docs/specs/builds-summary.md). Every figure comes
 * from the server; null shows a placeholder while it loads. */
export function BuildsSummary({ summary }: { summary: Summary | null }) {
  if (!summary)
    return (
      <Skeleton label="Loading summary" className="mt-6 sm:mt-8">
        <div className="grid grid-cols-3 gap-4 sm:gap-8">
          {[0, 1, 2].map((i) => (
            // Padding, not margins: stacked margins collapse and the cell comes out short.
            <div key={i} className={`${cell} [&>*]:py-[2px]`}>
              <div>
                <Bone className="h-[14px] w-16" />
              </div>
              <div>
                <Bone className="h-[18px] w-20 sm:h-[24px] sm:w-28" />
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
      <dl className="grid grid-cols-3 gap-4 tabular-nums sm:gap-8">
        <Figure
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
  label,
  amount,
  color = "",
  line,
}: {
  label: string;
  amount: string;
  color?: string;
  line: string;
}) {
  return (
    <div className={cell}>
      <dt className="text-[13px] leading-[18px] font-medium text-muted">
        {label}
      </dt>
      {/* Wraps instead of scrolling when a big amount meets a narrow phone. */}
      <dd
        className={`font-serif font-medium [overflow-wrap:anywhere] ${amountSize} ${color}`}
      >
        {amount}
      </dd>
      <dd className="text-[13px] leading-[18px] text-muted">{line}</dd>
    </div>
  );
}
