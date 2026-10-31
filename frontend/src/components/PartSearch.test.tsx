import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Part, PriceSearch, ShopProduct } from "../api";
import { PartForm } from "./PartRow";

// Only the pause is faked: reading a Response still needs the real event loop.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  Element.prototype.scrollIntoView = vi.fn(); // jsdom has none
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const MSI: ShopProduct = {
  shop: "PC Express",
  title: "MSI GeForce RTX™ 3060 VENTUS 2X OC 12GB GDDR6 192-bit Graphics Card",
  short_title: "MSI RTX 3060 VENTUS 2X OC 12GB",
  url: "https://pcx.com.ph/products/msi-rtx-3060",
  price: "26000.00",
  in_stock: true,
};

const GALAX: ShopProduct = {
  shop: "EasyPC",
  title: "Galax RTX 3060 1-Click OC",
  short_title: "Galax RTX 3060 1-Click OC",
  url: "https://easypc.com.ph/products/galax-rtx-3060",
  price: "19000.00",
  in_stock: false,
};

const found = (...results: ShopProduct[]): PriceSearch => ({
  results,
  updated_at: "2026-10-29T12:18:25+08:00",
});

const PART: Part = {
  id: 7,
  build: 3,
  name: "RTX 3060",
  category: "gpu",
  shop: "Facebook Marketplace",
  listed_price: "15000.00",
  bought_for: "13500.00",
  bundle: null,
};

function setup(responses: Response[], part: Part | null = null) {
  const fetchMock = vi.fn();
  for (const r of responses) fetchMock.mockResolvedValueOnce(r);
  vi.stubGlobal("fetch", fetchMock);
  const onSaved = vi.fn();
  const onClose = vi.fn();
  render(
    <PartForm
      part={part ?? undefined}
      bundles={[]}
      buildId={3}
      onSaved={onSaved}
      onClose={onClose}
    />,
  );
  return { fetchMock, onSaved, onClose };
}

const box = () => screen.getByRole("combobox", { name: "Part" });
const value = (label: string) =>
  (screen.getByLabelText(label) as HTMLInputElement).value;
const type = (text: string) =>
  fireEvent.change(box(), { target: { value: text } });
const press = (key: string) => fireEvent.keyDown(box(), { key });
const popup = () => screen.queryByRole("listbox");
/** The pop-up's rows; Category's <select> has options too. */
const rows = () => within(screen.getByRole("listbox")).getAllByRole("option");

/** Lets `ms` pass, then lets any search that answered reach the screen. */
const wait = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
    await new Promise((resolve) => setImmediate(resolve));
  });

/** Types `text` and waits out the pause, so the search has answered. */
async function search(text: string) {
  type(text);
  await wait(300);
}

test("searches only after a pause, and only with 2+ characters", async () => {
  const { fetchMock } = setup([Response.json(found(MSI))]);

  await search("r");
  expect(fetchMock).not.toHaveBeenCalled();

  type(" rtx 3060 ");
  await wait(299);
  expect(fetchMock).not.toHaveBeenCalled();
  await wait(1);
  expect(fetchMock.mock.calls[0][0]).toBe("/api/prices/?q=rtx+3060");
});

test("each row shows the short name, full name, price, shop and stock", async () => {
  setup([Response.json(found(MSI, GALAX))]);

  await search("rtx 3060");

  expect(box().getAttribute("aria-expanded")).toBe("true");
  expect(box().getAttribute("aria-controls")).toBe(popup()?.id);
  const [msi, galax] = rows();
  expect(within(msi).getByText(MSI.short_title)).toBeTruthy();
  expect(within(msi).getByText(MSI.title)).toBeTruthy();
  expect(msi.textContent).toContain("₱26,000.00");
  expect(msi.textContent).toContain("PC Express");
  expect(msi.textContent).not.toContain("Out of stock");
  expect(galax.textContent).toContain("Out of stock");
  // Its full name is its short name, so it isn't shown twice.
  expect(within(galax).getAllByText(GALAX.title)).toHaveLength(1);
});

test("shows at most 8 rows", async () => {
  const many = Array.from({ length: 20 }, (_, n) => ({
    ...MSI,
    url: `${MSI.url}-${n}`,
  }));
  setup([Response.json(found(...many))]);

  await search("rtx");

  expect(rows()).toHaveLength(8);
});

test("Down and Enter fill the name, price and shop, and only Save saves them", async () => {
  const { fetchMock, onSaved } = setup(
    [
      Response.json(found(MSI)),
      Response.json({ ...PART, name: "MSI RTX 3060 12GB" }),
    ],
    PART,
  );
  await search("rtx 3060");

  press("ArrowDown");
  const enter = press("Enter");

  expect(enter).toBe(false); // default prevented: the form doesn't submit
  expect(value("Part")).toBe(MSI.short_title);
  expect(value("Listed price")).toBe("₱26,000.00");
  expect(value("Shop")).toBe("PC Express");
  expect(value("Bought for")).toBe("₱13,500.00"); // untouched
  expect(popup()).toBeNull();
  expect(document.activeElement).toBe(box());
  expect(onSaved).not.toHaveBeenCalled();
  await wait(300); // picking doesn't search again
  expect(fetchMock).toHaveBeenCalledTimes(1);

  // All still editable before saving.
  type("MSI RTX 3060 12GB");
  fireEvent.submit(screen.getByRole("form", { name: "Edit RTX 3060" }));
  await wait(0);
  expect(JSON.parse(fetchMock.mock.calls.at(-1)?.[1].body)).toMatchObject({
    name: "MSI RTX 3060 12GB",
    listed_price: "26000.00",
    shop: "PC Express",
  });
});

test("clicking a row picks it without leaving the box", async () => {
  setup([Response.json(found(MSI))]);
  await search("rtx 3060");
  const [row] = rows();

  // A pressed mouse would move the focus and close the pop-up before the click lands.
  expect(fireEvent.mouseDown(row)).toBe(false);
  fireEvent.click(row);

  expect(value("Part")).toBe(MSI.short_title);
  expect(popup()).toBeNull();
});

test("Enter with no active row closes the pop-up and lets the form save", async () => {
  const { fetchMock } = setup([Response.json(found(MSI))]);
  await search("rtx 3060");

  expect(press("Enter")).toBe(true); // not prevented: the form submits (see the e2e test)

  expect(popup()).toBeNull();
  expect(value("Part")).toBe("rtx 3060");

  // Nor can a search that hadn't started open it again after the save.
  type("rtx 3060 ti");
  press("Enter");
  await wait(300);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(popup()).toBeNull();
});

test("Down and Up move through the rows and wrap, and the box says which is active", async () => {
  setup([Response.json(found(MSI, GALAX))]);
  await search("rtx 3060");
  const [first, second] = rows();
  const active = () => box().getAttribute("aria-activedescendant");

  expect(active()).toBeNull();
  press("ArrowDown");
  expect(active()).toBe(first.id);
  expect(first.getAttribute("aria-selected")).toBe("true");
  expect(second.getAttribute("aria-selected")).toBe("false");
  press("ArrowDown");
  expect(active()).toBe(second.id);
  press("ArrowDown");
  expect(active()).toBe(first.id);
  press("ArrowUp");
  expect(active()).toBe(second.id);
});

test("typing again clears the active row, so Enter can't pick an old result", async () => {
  setup([Response.json(found(MSI)), Response.json(found(GALAX))]);
  await search("rtx 3060");
  press("ArrowDown");

  type("rtx 3060 t");

  expect(box().getAttribute("aria-activedescendant")).toBeNull();
  expect(press("Enter")).toBe(true);
  expect(value("Part")).toBe("rtx 3060 t");
});

test("Esc closes only the pop-up; a second Esc closes the part", async () => {
  const { onClose } = setup([Response.json(found(MSI))]);
  await search("rtx 3060");

  press("Escape");

  expect(popup()).toBeNull();
  expect(box().getAttribute("aria-expanded")).toBe("false");
  expect(onClose).not.toHaveBeenCalled();
  expect(value("Part")).toBe("rtx 3060");

  press("Escape");
  expect(onClose).toHaveBeenCalled();
});

test("leaving the box closes the pop-up and drops a search that's still waiting", async () => {
  const { fetchMock } = setup([Response.json(found(MSI))]);
  await search("rtx 3060");

  fireEvent.blur(box());
  expect(popup()).toBeNull();

  type("rtx 3070");
  fireEvent.blur(box());
  await wait(300);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("opens only from typing, never from focusing the box", async () => {
  const { fetchMock } = setup([], PART);

  fireEvent.focus(box());
  press("ArrowDown");
  await wait(300);

  expect(fetchMock).not.toHaveBeenCalled();
  expect(popup()).toBeNull();
});

test("an older, slower search can't replace a newer one's rows", async () => {
  const { fetchMock } = setup([]);
  let answerFirst: (r: Response) => void = () => {};
  fetchMock
    .mockReturnValueOnce(new Promise<Response>((r) => (answerFirst = r)))
    .mockResolvedValueOnce(Response.json(found(GALAX)));

  await search("rtx");
  await search("rtx 3060");
  answerFirst(Response.json(found(MSI)));
  await wait(0);

  expect(rows()).toHaveLength(1);
  expect(rows()[0].textContent).toContain("Galax");
});

test("deleting back under 2 characters closes the pop-up", async () => {
  setup([Response.json(found(MSI))]);
  await search("rtx");

  type("r");

  expect(popup()).toBeNull();
});

test("no matches, or a failed search, shows nothing and typing carries on", async () => {
  setup([Response.json(found()), new Response(null, { status: 500 })]);

  await search("zzz");
  expect(popup()).toBeNull();

  await search("zzzz");
  expect(popup()).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(value("Part")).toBe("zzzz");
});
