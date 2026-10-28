import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState, type ComponentProps } from "react";
import { afterEach, expect, test, vi } from "vitest";
import type { Bundle, Part } from "../api";
import { EMPTY_TOTALS } from "../test/fixtures";
import { PartsTable as Table, type PartsOpen } from "./PartsTable";

/** The table with its open form held in state, as the page holds it. No bundles by default. */
function PartsTable({
  bundles = [],
  ...props
}: Omit<ComponentProps<typeof Table>, "open" | "setOpen" | "bundles"> & {
  bundles?: Bundle[];
}) {
  const [open, setOpen] = useState<PartsOpen>(null);
  return <Table {...props} bundles={bundles} open={open} setOpen={setOpen} />;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  const onChanged = vi.fn();
  render(
    <PartsTable
      buildId={3}
      parts={[]}
      totals={EMPTY_TOTALS}
      onChanged={onChanged}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Add part" }));
  const type = (label: string, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  type("Part", "Ryzen 5 7600");
  type("Category", "cpu");
  type("Listed price", "₱12,500");
  type("Bought for", "10500.50");
  fireEvent.submit(screen.getByRole("form", { name: "New part" }));
  return { fetchMock, onChanged };
}

test("shows the empty state before any parts exist", () => {
  render(
    <PartsTable
      buildId={3}
      parts={[]}
      totals={EMPTY_TOTALS}
      onChanged={() => {}}
    />,
  );

  expect(screen.getByText("No parts yet")).toBeTruthy();
});

test("adding a part posts it (without ₱ or separators) and refreshes", async () => {
  const { fetchMock, onChanged } = setup(
    Response.json({ id: 1 }, { status: 201 }),
  );

  await waitFor(() => expect(onChanged).toHaveBeenCalled());
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/parts/");
  expect(JSON.parse(init.body)).toEqual({
    build: 3,
    name: "Ryzen 5 7600",
    shop: "",
    category: "cpu",
    listed_price: "12500",
    bought_for: "10500.50",
  });
  expect((screen.getByLabelText("Part") as HTMLInputElement).value).toBe("");
});

test("a server validation error is shown on its field", async () => {
  const { onChanged } = setup(
    Response.json({ bought_for: ["Must be 0 or more."] }, { status: 400 }),
  );

  expect(await screen.findByText("Must be 0 or more.")).toBeTruthy();
  expect(screen.getByLabelText("Bought for").className).toContain(
    "border-loss",
  );
  expect(onChanged).not.toHaveBeenCalled();
});

test("a 400 on a field the form doesn't show still explains the failure", async () => {
  setup(
    Response.json(
      { build: ['Invalid pk "3" - object does not exist.'] },
      { status: 400 },
    ),
  );

  expect(await screen.findByRole("alert")).toBeTruthy();
});

test("Cancel closes the form", () => {
  setup(Response.json({ id: 1 }, { status: 201 }));

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(screen.queryByRole("form", { name: "New part" })).toBeNull();
});

const PARTS: Part[] = [
  {
    id: 7,
    build: 3,
    name: "Ryzen 5 7600",
    category: "cpu",
    shop: "Shopee",
    listed_price: "12500.00",
    bought_for: "10500.00",
    bundle: null,
  },
  {
    id: 8,
    build: 3,
    name: "RX 7600",
    category: "gpu",
    shop: "",
    listed_price: "16500.00",
    bought_for: "14200.00",
    bundle: null,
  },
];

// Each row renders as a mobile card and a desktop row (CSS hides one), so actions appear twice.
const clickAction = (name: string) =>
  fireEvent.click(screen.getAllByRole("button", { name })[0]);

function renderParts(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  const onChanged = vi.fn();
  render(
    <PartsTable
      buildId={3}
      parts={PARTS}
      totals={EMPTY_TOTALS}
      onChanged={onChanged}
    />,
  );
  return { fetchMock, onChanged };
}

test("editing a part patches it (prefilled, cleaned) and refreshes", async () => {
  const { fetchMock, onChanged } = renderParts(Response.json({ id: 7 }));

  clickAction("Edit Ryzen 5 7600");
  expect(
    (screen.getByLabelText("Listed price") as HTMLInputElement).value,
  ).toBe("₱12,500.00");
  fireEvent.change(screen.getByLabelText("Bought for"), {
    target: { value: "₱9,800" },
  });
  fireEvent.submit(screen.getByRole("form", { name: "Edit Ryzen 5 7600" }));

  await waitFor(() => expect(onChanged).toHaveBeenCalled());
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/parts/7/");
  expect(init.method).toBe("PATCH");
  expect(JSON.parse(init.body)).toEqual({
    name: "Ryzen 5 7600",
    shop: "Shopee",
    category: "cpu",
    listed_price: "12500.00",
    bought_for: "9800",
  });
  expect(screen.queryByRole("form")).toBeNull();
});

test("Esc discards the edit and shows the saved values", () => {
  const { fetchMock } = renderParts(Response.json({}));

  clickAction("Edit Ryzen 5 7600");
  fireEvent.change(screen.getByLabelText("Part"), {
    target: { value: "Something else" },
  });
  fireEvent.keyDown(screen.getByLabelText("Part"), { key: "Escape" });

  expect(screen.queryByRole("form")).toBeNull();
  expect(screen.getAllByText("Ryzen 5 7600").length).toBeGreaterThan(0);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("only one form is open at a time", () => {
  renderParts(Response.json({}));

  clickAction("Edit Ryzen 5 7600");
  clickAction("Edit RX 7600");
  expect(screen.getAllByRole("form").map((f) => f.ariaLabel)).toEqual([
    "Edit RX 7600",
  ]);

  fireEvent.click(screen.getByRole("button", { name: "Add part" }));
  expect(screen.getAllByRole("form").map((f) => f.ariaLabel)).toEqual([
    "New part",
  ]);
});

test("deleting a part sends DELETE and refreshes", async () => {
  const { fetchMock, onChanged } = renderParts(
    new Response(null, { status: 204 }),
  );

  clickAction("Delete RX 7600");

  await waitFor(() => expect(onChanged).toHaveBeenCalled());
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/parts/8/");
  expect(init.method).toBe("DELETE");
});

test("a failed delete says so", async () => {
  const { onChanged } = renderParts(Response.json({}, { status: 500 }));

  clickAction("Delete RX 7600");

  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(onChanged).not.toHaveBeenCalled();
});

test("bundled parts sit under their bundle, with its price and what's not assigned", () => {
  const bundle: Bundle = {
    id: 1,
    build: 3,
    name: "B550m + R5 5600 + 16GB",
    shop: "Marketplace",
    bought_for: "7500.00",
    listed_total: "9199.00",
    unassigned: "4000.00",
  };
  const inBundle = (id: number, name: string, bought_for: string | null) => ({
    ...PARTS[0],
    id,
    name,
    bought_for,
    bundle: 1,
  });
  render(
    <PartsTable
      buildId={3}
      parts={[
        inBundle(10, "Ryzen 5 5600", "3500.00"),
        PARTS[1],
        inBundle(11, "Asrock B550m", null),
      ]}
      bundles={[bundle]}
      totals={EMPTY_TOTALS}
      onChanged={() => {}}
    />,
  );

  const grouped = screen.getByRole("list", {
    name: "Parts in B550m + R5 5600 + 16GB",
  });
  expect(within(grouped).getAllByText("Ryzen 5 5600")).toHaveLength(2);
  expect(within(grouped).getAllByText("Asrock B550m")).toHaveLength(2);
  expect(within(grouped).queryByText("RX 7600")).toBeNull();
  // Each row renders as a phone card and a desktop row; CSS hides one.
  expect(within(grouped).getAllByText("—")).toHaveLength(2);
  expect(screen.getAllByText("Marketplace · 2 parts").length).toBeGreaterThan(
    0,
  );
  expect(screen.getAllByText("₱7,500.00")).toHaveLength(2);
  expect(screen.getAllByText("₱4,000.00 not assigned")).toHaveLength(2);
});

test("a fully assigned bundle shows no remainder", () => {
  render(
    <PartsTable
      buildId={3}
      parts={[]}
      bundles={[
        {
          id: 1,
          build: 3,
          name: "Deal",
          shop: "",
          bought_for: "500.00",
          listed_total: "0.00",
          unassigned: "0.00",
        },
      ]}
      totals={EMPTY_TOTALS}
      onChanged={() => {}}
    />,
  );

  expect(screen.queryByText("No parts yet")).toBeNull();
  expect(screen.getAllByText("0 parts").length).toBeGreaterThan(0);
  expect(screen.queryByText(/not assigned/)).toBeNull();
});
