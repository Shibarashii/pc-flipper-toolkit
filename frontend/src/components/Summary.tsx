import type { Totals } from "../api";
import { formatMoney, formatSignedMoney } from "../money";

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
  const loss = profit !== null && Number(profit) < 0;
  const heroColor =
    profit === null ? "text-faint" : loss ? "text-loss" : "text-profit";

  const hero = formatSignedMoney(profit);
  // ponytail: length-based step-down; "+₱3,700.00" (10 chars) is the widest that
  // fits the 320px column at 60px. Measure the text if profits outgrow 48px too.
  const heroSize =
    hero.length > 10
      ? "text-[48px] leading-[64px]"
      : "text-[60px] leading-[64px]";

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

      <div className="border-t border-line-strong pt-4 pb-5">
        <p className="text-[13px] leading-[18px] font-medium text-muted">
          Profit
        </p>
        <p
          className={`font-serif font-medium tracking-[-0.01em] whitespace-nowrap tabular-nums ${heroSize} ${heroColor}`}
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
        <dl className="flex flex-col gap-2.5">
          <Item label="Listed total" value={formatMoney(totals.listed_total)} />
          <Item label="Parts cost" value={formatMoney(totals.parts_cost)} />
          <Item label="Extra costs" value={formatMoney(totals.extra_costs)} />
          <Item
            label="Total cost"
            value={formatMoney(totals.total_cost)}
            strong
          />
        </dl>
        <dl className="flex flex-col gap-2.5 border-t border-line pt-2.5">
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
