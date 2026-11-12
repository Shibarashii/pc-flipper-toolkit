import type { Totals } from "../api";
import { formatMoney, formatSignedMoney, profitColor } from "../money";

function Item({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-4 text-[15px] leading-[22px] tabular-nums ${strong ? "font-medium" : ""}`}
    >
      <dt className={strong ? "" : "text-muted"}>{label}</dt>
      <dd className={value === "—" ? "text-faint" : ""}>{value}</dd>
    </div>
  );
}

/** "-66.67" → "66.67%". The sign is carried by the label instead. */
const pct = (value: string) => `${value.replace("-", "")}%`;

export function Summary({
  totals,
  sellingPrice,
}: {
  totals: Totals;
  sellingPrice: string | null;
}) {
  const { profit, profit_margin, below_market, below_market_pct } = totals;
  const heroColor = profitColor(profit);

  const hero = formatSignedMoney(profit);
  // The figure can't wrap, so it shrinks with its box (cqi: 1% of the box's width), up to
  // 60px. Measured in Newsreader: "+₱4,200.00" (10 characters) is 5.23 times its font
  // size wide, and each extra character adds 0.6.
  // ponytail: 13+ characters (₱1,000,000) overflow by a few percent; add a step if seen.
  const heroSize =
    hero.length <= 10
      ? "text-[length:min(60px,18.5cqi)]"
      : hero.length === 11
        ? "text-[length:min(60px,16.5cqi)]"
        : "text-[length:min(60px,15cqi)]";

  // Selling above market makes below_market negative; say "Above market" instead.
  const aboveMarket = below_market !== null && Number(below_market) < 0;
  let market = "—";
  if (below_market !== null) {
    market = formatMoney(below_market.replace("-", ""));
    if (below_market_pct !== null) market += ` · ${pct(below_market_pct)}`;
  }

  return (
    <section aria-labelledby="summary-title">
      <h2
        id="summary-title"
        className="pb-3 font-serif text-[22px] leading-[28px] font-medium"
      >
        Summary
      </h2>

      <div className="@container border-t border-line-strong px-3 pt-4 pb-5">
        <p className="text-[13px] leading-[18px] font-medium text-muted">
          Profit
        </p>
        <p
          className={`font-serif leading-[64px] font-medium tracking-[-0.01em] whitespace-nowrap tabular-nums ${heroSize} ${heroColor}`}
        >
          {hero}
        </p>
        <p
          className={`min-h-[18px] text-[13px] leading-[18px] font-medium ${profit === null ? "text-muted" : heroColor}`}
        >
          {profit === null
            ? "Set a selling price to see profit"
            : profit_margin !== null && `${profit_margin}% margin`}
        </p>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-line pt-4">
        <dl className="flex flex-col gap-2.5 px-3">
          <Item label="Listed total" value={formatMoney(totals.listed_total)} />
          <Item label="Parts cost" value={formatMoney(totals.parts_cost)} />
          <Item label="Extra costs" value={formatMoney(totals.extra_costs)} />
          <Item
            label="Total cost"
            value={formatMoney(totals.total_cost)}
            strong
          />
        </dl>
        <dl className="flex flex-col gap-2.5 border-t border-line px-3 pt-2.5">
          <Item label="Selling price" value={formatMoney(sellingPrice)} />
          <Item
            label={aboveMarket ? "Above market" : "Below market"}
            value={market}
          />
          <Item
            label="Voucher savings"
            value={formatMoney(totals.voucher_savings)}
          />
        </dl>
      </div>
    </section>
  );
}
