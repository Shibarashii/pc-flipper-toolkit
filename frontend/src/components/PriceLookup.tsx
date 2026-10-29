import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { findPrices, type PriceSearch, type ShopProduct } from "../api";
import { formatMoney } from "../money";
import { buttonSecondary, input, link } from "../ui";

type State =
  | { status: "idle" | "short" | "loading" | "failed" }
  | { status: "done"; search: PriceSearch };

/** "2026-10-29T12:18:25+08:00" → "Oct 29", in the viewer's time zone. */
const formatDay = (time: string) =>
  new Date(time).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

/** Search the PC shops' prices and pick one (docs/specs/price-lookup.md). Lives inside the
 * part form, so it can't be a <form> itself: Enter searches instead of saving the part,
 * and Esc closes only this panel. */
export function PriceLookup({
  id,
  initialQuery,
  onPick,
  onClose,
}: {
  id: string;
  initialQuery: string;
  onPick: (product: ShopProduct) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery.trim());
  // The part's name is searched straight away, if it's long enough.
  const searchesFirst = initialQuery.trim().length >= 2;
  const [state, setState] = useState<State>({
    status: searchesFirst ? "loading" : "idle",
  });
  // Only the newest search may show its results; an older, slower one is dropped.
  const latest = useRef(0);

  const fetchResults = useCallback((q: string) => {
    const mine = ++latest.current;
    findPrices(q).then(
      (search) =>
        mine === latest.current && setState({ status: "done", search }),
      () => mine === latest.current && setState({ status: "failed" }),
    );
  }, []);

  // initialQuery is the name when the panel opened, so this runs once.
  useEffect(() => {
    if (searchesFirst) fetchResults(initialQuery.trim());
  }, [searchesFirst, initialQuery, fetchResults]);

  function search(q: string) {
    if (q.trim().length < 2) {
      setState({ status: "short" });
      return;
    }
    setState({ status: "loading" });
    fetchResults(q.trim());
  }

  function keys(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation(); // keep the part form open
      onClose();
    }
  }

  return (
    <div id={id} role="group" aria-label="Find prices" onKeyDown={keys}>
      <div className="flex gap-2">
        <input
          autoFocus
          type="search"
          aria-label="Search the shops"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // not the part form's Save
              search(query);
            }
          }}
          placeholder="e.g. rtx 3060"
          maxLength={100}
          className={input()}
        />
        <button
          type="button"
          onClick={() => search(query)}
          className={buttonSecondary}
        >
          Search
        </button>
        <button type="button" onClick={onClose} className={buttonSecondary}>
          Close
        </button>
      </div>
      <Results state={state} onPick={onPick} />
    </div>
  );
}

/** The one line that says what's happening. It's always in the page (empty when there's
 * nothing to say), so screen readers announce each change. */
function statusText(state: State): string {
  switch (state.status) {
    case "idle":
    case "failed": // said by the alert instead
      return "";
    case "short":
      return "Type at least 2 characters.";
    case "loading":
      return "Searching…";
  }
  const { results, updated_at } = state.search;
  if (updated_at === null) return "Prices aren’t loaded yet.";
  if (results.length === 0) return "No matches at EasyPC or PC Express.";
  return `Prices from ${formatDay(updated_at)}. Choose one to fill in the price and shop.`;
}

function Results({
  state,
  onPick,
}: {
  state: State;
  onPick: (product: ShopProduct) => void;
}) {
  const results =
    state.status === "done" && state.search.updated_at !== null
      ? state.search.results
      : [];
  return (
    <>
      <p role="status" className="mt-3 text-[13px] leading-[18px] text-muted">
        {statusText(state)}
      </p>
      {state.status === "failed" && (
        <p role="alert" className="mt-3 text-[13px] leading-[18px] text-loss">
          Couldn’t load prices. Type the price instead.
        </p>
      )}
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {results.map((product) => (
            <li key={product.url} className="flex items-start gap-3 py-2">
              <button
                type="button"
                onClick={() => onPick(product)}
                // Padded out and pulled back, so the hover fill has room and the text
                // still lines up with the search box.
                className="-mx-1.5 min-w-0 flex-1 rounded px-1.5 text-left hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span className="block text-[14px] leading-5 text-ink">
                  {product.title}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[18px] text-muted">
                  <span className="font-medium text-ink tabular-nums">
                    {formatMoney(product.price)}
                  </span>
                  <span>{product.shop}</span>
                  {!product.in_stock && (
                    <span className="rounded border border-muted px-1.5 font-medium">
                      Out of stock
                    </span>
                  )}
                </span>
              </button>
              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`View ${product.title} at ${product.shop}`}
                className={`${link} shrink-0 py-0.5`}
              >
                View
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
