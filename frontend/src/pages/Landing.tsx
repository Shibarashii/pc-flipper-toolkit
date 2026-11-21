import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ApiError, generalError, tryDemo } from "../api";
import { saveSession } from "../auth";
import { BuildChecklist } from "../components/BuildChecklist";
import { BuildDiagram } from "../components/BuildDiagram";
import { StatusTag } from "../components/StatusTag";
import { Summary } from "../components/Summary";
import { SOLD_BUILD } from "../landingDemo";
import { formatMoney, formatSignedMoney } from "../money";
import { SITE_NAME, SITE_URL } from "../site";
import { buildSlots } from "../slots";
import { buttonPrimary, buttonSecondary, focusRing } from "../ui";

const { slots } = buildSlots(SOLD_BUILD.parts);
const profit = formatSignedMoney(SOLD_BUILD.totals.profit);

/** Logged out, `/`: what the app is, with the demo's sold build as the picture
 * (docs/specs/landing-page.md). */
export function Landing() {
  return (
    <main>
      <title>{`${SITE_NAME} · Track the profit on every PC you flip`}</title>
      <link rel="canonical" href={`${SITE_URL}/`} />

      <div className="mx-auto max-w-[1280px] px-4 md:px-16">
        <div className="pt-10 xl:flex xl:justify-between xl:gap-[52px] xl:pt-0">
          <div className="flex max-w-[460px] flex-col gap-3 sm:gap-4 xl:pt-[72px]">
            <p className="text-[13px] leading-[18px] font-medium text-accent">
              For people who flip PCs
            </p>
            <h1 className="font-serif text-[40px] leading-[44px] font-medium tracking-[-0.01em] sm:text-[60px] sm:leading-[64px]">
              See the real profit on every PC you flip
            </h1>
            <p className="text-[15px] leading-[22px] text-muted">
              Log each part, bundle and extra cost. The app does the math.
            </p>
            <WaysIn note="No sign-up needed. Deleted after 24 hours." />
          </div>

          {/* A picture, named once for screen readers. Its parts are inert, so nothing in
              them can be clicked or focused; the label stays outside, since inert hides its
              own. */}
          <div
            role="img"
            aria-label={`A sold build: its parts in the case, and ${profit} profit`}
            className="mt-10"
          >
            <div inert>
              <PhoneArt />
              <DesktopArt />
            </div>
          </div>
        </div>

        <BuildPanel />
        <WhatItTracks />
        <Equation />
        <Questions />
      </div>

      <FadeIn className="mt-[72px] border-t border-line bg-sunken px-4 py-14 text-center sm:mt-28 sm:py-20">
        <h2 className={sectionTitle}>Try it on two sample builds</h2>
        <WaysIn
          centered
          line="No sign-up needed. Your demo is deleted after 24 hours."
        />
      </FadeIn>
    </main>
  );
}

/** Try the demo and Sign up, with a note or a line. Each copy keeps its own state, so an
 * error shows under the button that was pressed. */
function WaysIn({
  note,
  line,
  centered = false,
}: {
  note?: string;
  line?: string;
  centered?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // As on the log-in page: the session opens the demo's builds at `/`, or the same error.
  async function startDemo() {
    setSaving(true);
    setError("");
    try {
      saveSession(await tryDemo());
    } catch (err) {
      setError(
        generalError(err, err instanceof ApiError ? err.fieldErrors : {}),
      );
      setSaving(false);
    }
  }

  return (
    <>
      {line && (
        <p className="mt-3 text-[15px] leading-[22px] text-muted sm:mt-4">
          {line}
        </p>
      )}
      <div
        className={`flex gap-3 pt-2 sm:pt-3 ${centered ? "mt-3 justify-center sm:mt-4" : ""}`}
      >
        <button
          type="button"
          onClick={startDemo}
          disabled={saving}
          className={buttonPrimary}
        >
          Try the demo
        </button>
        <Link to="/signup" className={buttonSecondary}>
          Sign up
        </Link>
      </div>
      {error && (
        <p
          role="alert"
          className={`text-[13px] leading-[18px] text-loss ${centered ? "mt-3" : ""}`}
        >
          {error}
        </p>
      )}
      {note && <p className="text-[13px] leading-[18px] text-muted">{note}</p>}
    </>
  );
}

const sectionTitle =
  "font-serif text-[22px] leading-[28px] font-medium sm:text-[40px] sm:leading-[44px] sm:tracking-[-0.01em]";

/** A block below the hero: 112px apart on desktop, 72px on phones. */
function Block({
  title,
  line,
  children,
}: {
  title: string;
  line?: string;
  children: ReactNode;
}) {
  return (
    <FadeIn className="pt-[72px] sm:pt-28">
      <h2 className={sectionTitle}>{title}</h2>
      {line && (
        <p className="mt-3 max-w-[560px] text-[15px] leading-[22px] text-muted sm:mt-4">
          {line}
        </p>
      )}
      {children}
    </FadeIn>
  );
}

/** A section that eases in from 16px lower the first time it scrolls into view. Its words
 * are in the page from the start (for search); only its look waits. With reduce motion set,
 * or without IntersectionObserver, it shows at once. */
function FadeIn({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(
    () => typeof IntersectionObserver === "undefined",
  );
  useEffect(() => {
    if (shown) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setShown(true);
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, [shown]);
  return (
    <section
      ref={ref}
      data-shown={shown}
      className={`transition duration-700 ease-out motion-safe:data-[shown=false]:translate-y-4 motion-safe:data-[shown=false]:opacity-0 ${className}`}
    >
      {children}
    </section>
  );
}

/** The build page's Build and Summary with the demo's build. Desktop cuts it at 440px;
 * below 1280px, where the page stacks, only the Summary shows. */
function BuildPanel() {
  return (
    <Block
      title="Every flip, part by part"
      line="Each build shows its parts, what’s still missing, and the profit as it adds up."
    >
      <div
        role="img"
        aria-label="The demo’s sold build on its build page: its parts and its summary"
        className="mt-3 sm:mt-10"
      >
        <div
          inert
          className="grid rounded-lg border border-line-strong bg-surface p-4 sm:p-8 xl:h-[440px] xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-14 xl:overflow-hidden"
        >
          <div className="xl:col-start-2 xl:row-start-1">
            <Summary
              totals={SOLD_BUILD.totals}
              sellingPrice={SOLD_BUILD.sellingPrice}
            />
          </div>
          <div className="hidden min-w-0 xl:col-start-1 xl:row-start-1 xl:block">
            <BuildChecklist parts={SOLD_BUILD.parts} onAdd={() => {}} />
          </div>
        </div>
      </div>
    </Block>
  );
}

const gpu = SOLD_BUILD.parts.find((p) => p.category === "gpu")!;

/** Three small pictures on `sunken`, each above a name and one line. */
function WhatItTracks() {
  const items = [
    {
      name: "Parts",
      line: "Shop price and what you paid. A bundle counts once.",
      picture: (
        <>
          <span className="flex h-14 w-[200px] items-center justify-center rounded border border-accent bg-slot-fill text-[13px] leading-[18px] font-medium">
            {gpu.name}
          </span>
          <span className="text-[13px] leading-[18px] text-muted">
            Paid {shortMoney(gpu.bought_for)} · shop{" "}
            {shortMoney(gpu.listed_price)}
          </span>
        </>
      ),
    },
    {
      name: "Extra costs",
      line: "Shipping, platform fees, thermal paste.",
      picture: (
        <span className="w-full px-4 sm:px-6">
          {SOLD_BUILD.extraCosts.map(({ label, amount }) => (
            <span
              key={label}
              className="flex justify-between gap-4 border-b border-line py-2 text-[15px] leading-[22px] tabular-nums"
            >
              <span>{label}</span>
              <span>{formatMoney(amount)}</span>
            </span>
          ))}
        </span>
      ),
    },
    {
      name: "Status",
      line: "Planning, building, listed or sold: see where each PC is.",
      picture: (
        <span className="flex gap-1.5">
          {(["planning", "building", "listed", "sold"] as const).map((s) => (
            <StatusTag key={s} status={s} />
          ))}
        </span>
      ),
    },
  ];
  return (
    <Block title="What it tracks">
      <ul className="mt-5 grid gap-3 sm:mt-8 sm:grid-cols-3 sm:gap-8">
        {items.map(({ name, line, picture }) => (
          <li key={name}>
            {/* Its name and line say what the picture shows. */}
            <div
              inert
              className="flex h-[120px] flex-col items-center justify-center gap-1.5 rounded-md bg-sunken sm:h-[140px]"
            >
              {picture}
            </div>
            <h3 className="mt-1.5 text-[15px] leading-[22px] font-medium sm:mt-4">
              {name}
            </h3>
            <p className="mt-1.5 text-[15px] leading-[22px] text-muted">
              {line}
            </p>
          </li>
        ))}
      </ul>
    </Block>
  );
}

// "4200.00" → "₱4,200": a whole amount reads better without the centavos.
const wholePesos = (money: string) => money.replace(/\.00$/, "");
const shortMoney = (value: string | null) => wholePesos(formatMoney(value));

/** Sold for − total cost = profit, in the serif: a row on desktop, stacked on phones. */
function Equation() {
  const { totals } = SOLD_BUILD;
  const terms = [
    { op: "", value: shortMoney(SOLD_BUILD.sellingPrice), label: "Sold for" },
    {
      op: "−",
      value: shortMoney(totals.total_cost),
      label: `Parts ${shortMoney(totals.parts_cost)} + extra costs ${shortMoney(totals.extra_costs)}`,
    },
    {
      op: "=",
      value: wholePesos(formatSignedMoney(totals.profit)),
      label: `Profit · ${totals.profit_margin}% of the selling price`,
      profit: true,
    },
  ];
  const serif =
    "font-serif text-[40px] leading-[44px] font-medium tracking-[-0.01em] tabular-nums";
  return (
    <Block title="How profit is worked out">
      <div className="mt-5 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:gap-8">
        {terms.map(({ op, value, label, profit }) => (
          <div key={label} className="flex gap-3 sm:gap-8">
            {/* The first term has no sign; phones keep its column so the numbers line up. */}
            <span
              aria-hidden={!op}
              className={`w-7 shrink-0 text-faint ${serif} ${op ? "" : "sm:hidden"}`}
            >
              {op}
            </span>
            <span className="flex flex-col gap-0.5 sm:gap-1">
              <span className={`${serif} ${profit ? "text-profit" : ""}`}>
                {value}
              </span>
              <span className="text-[13px] leading-[18px] text-muted">
                {label}
              </span>
            </span>
          </div>
        ))}
      </div>
    </Block>
  );
}

const QUESTIONS = [
  [
    "How do I track profit when flipping PCs?",
    "Make a build for each PC, add every part with what you paid and the extra costs, then set the selling price. The app adds it up on each build and across all your builds.",
  ],
  ["Is it free?", "Yes."],
  [
    "Can I try it without an account?",
    "Yes. Try the demo gives you your own account with two sample builds to change as you like. It’s deleted after 24 hours.",
  ],
  [
    "Where do the shop prices come from?",
    "When you add a part, you can search current prices from EasyPC and PC Express, refreshed once a day, or type a price yourself.",
  ],
];

/** `<details>` rows, the first open: every answer stays in the page for search, and the
 * browser handles the keyboard. */
function Questions() {
  return (
    <Block title="Questions">
      <div className="mt-5 max-w-[768px] border-b border-line sm:mt-8">
        {QUESTIONS.map(([question, answer], i) => (
          <details
            key={question}
            open={i === 0}
            className="group border-t border-line py-4 sm:py-[18px]"
          >
            <summary
              className={`flex cursor-pointer list-none items-center gap-4 rounded text-[15px] leading-[22px] font-medium [&::-webkit-details-marker]:hidden ${focusRing}`}
            >
              <span className="flex-1">{question}</span>
              <svg
                aria-hidden
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="shrink-0 text-muted"
              >
                <path d="M3 8H13" />
                <path d="M8 3V13" className="group-open:hidden" />
              </svg>
            </summary>
            <p className="mt-2 text-[15px] leading-[22px] text-muted">
              {answer}
            </p>
          </details>
        ))}
      </div>
    </Block>
  );
}

function Tag({ name, price }: { name: string; price: string }) {
  return (
    <span className="flex gap-1.5 rounded border border-line-strong bg-surface px-2 py-[5px] text-[13px] leading-[18px] whitespace-nowrap md:gap-2 md:px-2.5 md:py-1.5">
      <span className="font-medium">{name}</span>
      <span className="text-muted">{price}</span>
    </span>
  );
}

/** The profit, as in the build's Summary, with what it was sold for. */
function ProfitCard() {
  return (
    <div className="w-[382px] rounded-md border border-line-strong bg-surface px-5 pt-4 pb-9">
      <p className="text-[13px] leading-[18px] font-medium text-muted">
        Profit
      </p>
      <p className="mt-0.5 font-serif text-[60px] leading-[64px] font-medium tracking-[-0.01em] whitespace-nowrap text-profit tabular-nums">
        {profit}
      </p>
      <p className="mt-0.5 text-[13px] leading-[18px] font-medium text-profit">
        {SOLD_BUILD.totals.profit_margin}% margin · sold for{" "}
        {shortMoney(SOLD_BUILD.sellingPrice)}
      </p>
    </div>
  );
}

/** From 768px: the diagram at 1.3×, hairlines from three parts to their prices. */
function DesktopArt() {
  // Each line runs from its dot on the part to the tag at x 410; y is the line's.
  const tags = [
    { x: 247.4, y: 144.8, name: "Board + CPU + RAM", price: "₱9,500 bundle" },
    { x: 348.8, y: 306, name: "RX 6600 8GB", price: "₱11,000" },
    { x: 192.8, y: 441.2, name: "650W PSU", price: "₱2,400" },
  ];
  return (
    <div className="relative mx-auto hidden h-[600px] w-[640px] md:block">
      <div className="absolute top-5 left-0 h-[494px] w-[390px]">
        <div className="origin-top-left scale-[1.3]">
          <BuildDiagram slots={slots} />
        </div>
      </div>
      {tags.map(({ x, y, name, price }) => (
        <div key={name}>
          <span
            className="absolute h-px bg-line-strong"
            style={{ left: x, top: y - 0.5, width: 410 - x }}
          />
          <span
            className="absolute size-[7px] rounded-full bg-accent"
            style={{ left: x - 3.5, top: y - 3.5 }}
          />
          <span className="absolute left-[410px]" style={{ top: y - 16 }}>
            <Tag name={name} price={price} />
          </span>
        </div>
      ))}
      <div className="absolute top-[420px] left-[300px]">
        <ProfitCard />
      </div>
    </div>
  );
}

/** Phones: the diagram a little smaller, two short tags, and the card at 0.78×. Placed from
 * the right, so a 320px screen only overlaps them more. */
function PhoneArt() {
  return (
    <div className="relative h-[470px] w-full max-w-[343px] md:hidden">
      <div className="absolute top-8 left-0 h-[361px] w-[285px]">
        <div className="origin-top-left scale-[0.95]">
          <BuildDiagram slots={slots} />
        </div>
      </div>
      <span className="absolute top-[109px] right-[43px]">
        <Tag name="Bundle" price="₱9,500" />
      </span>
      <span className="absolute top-[227px] right-[19px]">
        <Tag name="RX 6600" price="₱11,000" />
      </span>
      <div className="absolute top-[348px] right-0 h-[122px] w-[298px]">
        <div className="origin-top-left scale-[0.78]">
          <ProfitCard />
        </div>
      </div>
    </div>
  );
}
