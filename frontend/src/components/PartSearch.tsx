import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from "react";
import { findPrices, type ShopProduct } from "../api";
import { input } from "../ui";
import { Field } from "./form";
import { ProductFacts } from "./PriceLookup";

const PAUSE = 300; // ms after the last keystroke
const MAX_ROWS = 8;

const optionId = (listId: string, row: number) => `${listId}-${row}`;

/** The part form's Part box: typing searches the shops' copy and offers a pop-up of products
 * (docs/specs/price-lookup.md, part 2). A combobox with a listbox pop-up, in the WAI-ARIA
 * pattern. The pop-up is only a suggestion, so it stays out of the way of plain typing: a
 * failed search shows nothing, and Enter saves the part unless a row is active.
 *
 * The pop-up sits outside Field's <label>, or its text would become part of the box's name. */
export function PartSearch({
  value,
  onChange,
  onPick,
  inputRef,
  errors,
  className = "",
}: {
  value: string;
  onChange: (name: string) => void;
  onPick: (product: ShopProduct) => void;
  inputRef: Ref<HTMLInputElement>;
  errors?: string[];
  className?: string;
}) {
  const [rows, setRows] = useState<ShopProduct[]>([]);
  const [active, setActive] = useState(-1); // the highlighted row; -1 is none
  const listId = useId();
  const open = rows.length > 0;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Only the newest search may show its rows; an older, slower one is dropped.
  const latest = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Arrow keys can reach rows below the pop-up's scroll.
  useEffect(() => {
    if (active >= 0)
      document
        .getElementById(optionId(listId, active))
        ?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  /** New rows always clear the highlight: the old position may not exist any more. */
  function show(products: ShopProduct[]) {
    setRows(products);
    setActive(-1);
  }

  /** Closes the pop-up and drops any search that's waiting or on its way. */
  function close() {
    clearTimeout(timer.current);
    latest.current++;
    show([]);
  }

  function search(q: string) {
    const mine = ++latest.current;
    findPrices(q).then(
      ({ results }) =>
        mine === latest.current && show(results.slice(0, MAX_ROWS)),
      () => mine === latest.current && show([]),
    );
  }

  function type(text: string) {
    onChange(text);
    const q = text.trim();
    if (q.length < 2) {
      close();
      return;
    }
    // The old rows stay until the new ones arrive, but Enter can no longer pick one.
    setActive(-1);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(q), PAUSE);
  }

  function pick(product: ShopProduct) {
    close();
    onPick(product);
  }

  function keys(e: KeyboardEvent) {
    if (e.key === "Enter") {
      if (active >= 0) {
        e.preventDefault(); // not the part form's Save
        pick(rows[active]);
      } else {
        close(); // and the form saves, as usual
      }
    } else if (!open) {
      return;
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((row) => (row + 1) % rows.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((row) => (row <= 0 ? rows.length : row) - 1);
    } else if (e.key === "Escape") {
      e.stopPropagation(); // keep the part form open
      close();
    }
  }

  return (
    <div className={`relative ${className}`}>
      <Field label="Part" errors={errors}>
        <input
          ref={inputRef}
          autoFocus
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={
            active >= 0 ? optionId(listId, active) : undefined
          }
          autoComplete="off"
          value={value}
          onChange={(e) => type(e.target.value)}
          onKeyDown={keys}
          onBlur={close}
          placeholder="Part name"
          maxLength={200}
          aria-invalid={!!errors}
          className={input(!!errors)}
        />
      </Field>
      {/* Always in the page, so screen readers announce each change. */}
      <p role="status" className="sr-only">
        {open &&
          `${rows.length} ${rows.length === 1 ? "product" : "products"} found. Use the up and down arrows to choose.`}
      </p>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Shop products"
          // Keeps the focus in the box, so the pop-up isn't closed before a click lands.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute top-full left-0 z-10 mt-1 max-h-80 w-full divide-y divide-line overflow-y-auto rounded border border-line-strong bg-surface"
        >
          {rows.map((product, row) => (
            <li
              key={product.url}
              id={optionId(listId, row)}
              role="option"
              aria-selected={row === active}
              onClick={() => pick(product)}
              className={`cursor-pointer px-3 py-2 hover:bg-sunken ${row === active ? "bg-sunken" : ""}`}
            >
              <span className="block text-[15px] leading-[22px] text-ink">
                {product.short_title}
              </span>
              {product.title !== product.short_title && (
                <span className="block text-[13px] leading-[18px] text-muted">
                  {product.title}
                </span>
              )}
              <ProductFacts product={product} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
