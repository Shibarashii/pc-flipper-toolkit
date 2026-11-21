import { useState } from "react";
import { Link } from "react-router";
import { ApiError, generalError, tryDemo } from "../api";
import { saveSession } from "../auth";
import { BuildDiagram } from "../components/BuildDiagram";
import { SOLD_BUILD } from "../landingDemo";
import { formatMoney, formatSignedMoney } from "../money";
import { SITE_NAME, SITE_URL } from "../site";
import { buildSlots } from "../slots";
import { buttonPrimary, buttonSecondary } from "../ui";

const { slots } = buildSlots(SOLD_BUILD.parts);
const profit = formatSignedMoney(SOLD_BUILD.totals.profit);
// "₱32,000.00" → "₱32,000": a round price reads better without the centavos.
const soldFor = formatMoney(SOLD_BUILD.sellingPrice).replace(/\.00$/, "");

/** Logged out, `/`: what the app is, with the demo's sold build as the picture
 * (docs/specs/landing-page.md). */
export function Landing() {
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
    <main className="mx-auto max-w-[1280px] px-4 pt-10 pb-16 md:px-16 xl:flex xl:justify-between xl:gap-[52px] xl:pt-0 xl:pb-0">
      <title>{`${SITE_NAME} · Track the profit on every PC you flip`}</title>
      <link rel="canonical" href={`${SITE_URL}/`} />

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
        <div className="flex gap-3 pt-2 sm:pt-3">
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
          <p role="alert" className="text-[13px] leading-[18px] text-loss">
            {error}
          </p>
        )}
        <p className="text-[13px] leading-[18px] text-muted">
          No sign-up needed. Deleted after 24 hours.
        </p>
      </div>

      {/* A picture, named once for screen readers. Its parts are inert, so nothing in them
          can be clicked or focused; the label stays outside, since inert hides its own. */}
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
    </main>
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
        {SOLD_BUILD.totals.profit_margin}% margin · sold for {soldFor}
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
