import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { Part, PriceSearch } from "../api";
import { PartForm } from "./PartRow";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const SEARCH: PriceSearch = {
  results: [
    {
      shop: "PC Express",
      title: "MSI GeForce RTX 3060 VENTUS 2X OC 12GB",
      url: "https://pcx.com.ph/products/msi-rtx-3060",
      price: "26000.00",
      in_stock: true,
    },
    {
      shop: "EasyPC",
      title: "MSI RTX 3060 Ti Ventus 2X OC 8GB",
      url: "https://easypc.com.ph/products/msi-rtx-3060ti",
      price: "23390.00",
      in_stock: false,
    },
  ],
  updated_at: "2026-10-29T12:18:25+08:00",
};

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

/** The part form editing PART (or adding, with null), with fetch answering `responses` in turn. */
function setup(responses: Response[], part: Part | null = PART) {
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

const value = (label: string) =>
  (screen.getByLabelText(label) as HTMLInputElement).value;
const openLookup = () =>
  fireEvent.click(screen.getByRole("button", { name: "Find prices" }));

test("searches the part's name and lists each match with its shop and stock", async () => {
  const { fetchMock } = setup([Response.json(SEARCH)]);

  openLookup();

  expect(value("Search the shops")).toBe("RTX 3060");
  expect(await screen.findByText(/^Prices from Oct 29\./)).toBeTruthy();
  expect(fetchMock.mock.calls[0][0]).toBe("/api/prices/?q=RTX+3060");
  const [inStock, gone] = screen.getAllByRole("listitem");
  expect(inStock.textContent).toContain("₱26,000.00");
  expect(inStock.textContent).toContain("PC Express");
  expect(inStock.textContent).not.toContain("Out of stock");
  expect(gone.textContent).toContain("Out of stock");
  const view = within(inStock).getByRole("link", {
    name: "View MSI GeForce RTX 3060 VENTUS 2X OC 12GB at PC Express",
  });
  expect(view.getAttribute("href")).toBe(SEARCH.results[0].url);
  expect(view.getAttribute("target")).toBe("_blank");
  expect(view.getAttribute("rel")).toBe("noopener noreferrer");
});

test("choosing a result fills the price and shop, and only Save saves them", async () => {
  const { fetchMock, onSaved } = setup([
    Response.json(SEARCH),
    Response.json({ ...PART, listed_price: "26000.00", shop: "PC Express" }),
  ]);
  openLookup();

  fireEvent.click(
    await screen.findByRole("button", { name: /^MSI GeForce RTX 3060 VENTUS/ }),
  );

  expect(value("Listed price")).toBe("₱26,000.00");
  expect(value("Shop")).toBe("PC Express");
  expect(screen.queryByRole("group", { name: "Find prices" })).toBeNull();
  expect(document.activeElement).toBe(screen.getByLabelText("Listed price"));
  expect(fetchMock).toHaveBeenCalledTimes(1); // the search only

  // Still editable before saving.
  fireEvent.change(screen.getByLabelText("Listed price"), {
    target: { value: "25500" },
  });
  fireEvent.submit(screen.getByRole("form", { name: "Edit RTX 3060" }));

  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  const [url, init] = fetchMock.mock.calls[1];
  expect(url).toBe("/api/parts/7/");
  expect(JSON.parse(init.body)).toMatchObject({
    listed_price: "25500",
    shop: "PC Express",
  });
});

test("Enter in the search box searches instead of saving the part", async () => {
  const { fetchMock, onSaved } = setup([
    Response.json(SEARCH),
    Response.json({ ...SEARCH, results: [] }),
  ]);
  openLookup();
  await screen.findByText(/^Prices from/);

  const box = screen.getByLabelText("Search the shops");
  fireEvent.change(box, { target: { value: "rx 6600" } });
  fireEvent.keyDown(box, { key: "Enter" });

  expect(
    await screen.findByText("No matches at EasyPC or PC Express."),
  ).toBeTruthy();
  expect(fetchMock.mock.calls[1][0]).toBe("/api/prices/?q=rx+6600");
  expect(onSaved).not.toHaveBeenCalled();
});

test("Esc closes the lookup but keeps the part open; a second Esc closes the part", async () => {
  const { onClose } = setup([Response.json(SEARCH)]);
  openLookup();
  await screen.findByText(/^Prices from/);

  fireEvent.keyDown(screen.getByLabelText("Search the shops"), {
    key: "Escape",
  });

  expect(screen.queryByRole("group", { name: "Find prices" })).toBeNull();
  expect(onClose).not.toHaveBeenCalled();
  const find = screen.getByRole("button", { name: "Find prices" });
  expect(document.activeElement).toBe(find);
  expect(value("Listed price")).toBe("₱15,000.00"); // unchanged

  fireEvent.keyDown(find, { key: "Escape" });
  expect(onClose).toHaveBeenCalled();
});

test("a failed search says to type the price, and the form still saves", async () => {
  const { fetchMock, onSaved } = setup([
    new Response(null, { status: 500 }),
    Response.json(PART),
  ]);
  openLookup();

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Couldn’t load prices. Type the price instead.",
  );

  fireEvent.change(screen.getByLabelText("Listed price"), {
    target: { value: "14000" },
  });
  fireEvent.submit(screen.getByRole("form", { name: "Edit RTX 3060" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).listed_price).toBe(
    "14000",
  );
});

test("before the first refresh, it says the prices aren't loaded", async () => {
  setup([Response.json({ results: [], updated_at: null })]);
  openLookup();

  expect(await screen.findByText("Prices aren’t loaded yet.")).toBeTruthy();
});

test("a new part with no name yet waits for a search of 2+ characters", () => {
  const { fetchMock } = setup([], null);
  openLookup();

  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Search the shops"), {
    target: { value: "a" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));

  expect(screen.getByText("Type at least 2 characters.")).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
});
