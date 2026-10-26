import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { ExtraCost } from "../api";
import { ExtraCosts } from "./ExtraCosts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const COSTS: ExtraCost[] = [
  { id: 4, build: 3, label: "Shipping", amount: "350.00" },
  { id: 5, build: 3, label: "Platform fee", amount: "300.00" },
];

function renderCosts(response: Response, costs = COSTS) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  const onChanged = vi.fn();
  render(
    <ExtraCosts
      buildId={3}
      costs={costs}
      total="650.00"
      onChanged={onChanged}
    />,
  );
  return { fetchMock, onChanged };
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

test("shows the empty state and no total before any costs exist", () => {
  renderCosts(Response.json({}), []);

  expect(screen.getByText("No extra costs yet")).toBeTruthy();
  expect(screen.queryByText(/total/)).toBeNull();
});

test("shows each cost and the total", () => {
  renderCosts(Response.json({}));

  expect(screen.getByText("₱650.00 total")).toBeTruthy();
  expect(screen.getByText("₱350.00")).toBeTruthy();
});

test("adding a cost posts it (without ₱ or separators) and refreshes", async () => {
  const { fetchMock, onChanged } = renderCosts(
    Response.json({ id: 6 }, { status: 201 }),
  );

  fireEvent.click(screen.getByRole("button", { name: "Add cost" }));
  type("Label", "Thermal paste");
  type("Amount", "₱1,150");
  fireEvent.submit(screen.getByRole("form", { name: "New cost" }));

  await waitFor(() => expect(onChanged).toHaveBeenCalled());
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/extra-costs/");
  expect(JSON.parse(init.body)).toEqual({
    build: 3,
    label: "Thermal paste",
    amount: "1150",
  });
});

test("a negative amount shows the error on the field", async () => {
  const { onChanged } = renderCosts(
    Response.json({ amount: ["Must be 0 or more."] }, { status: 400 }),
  );

  fireEvent.click(screen.getByRole("button", { name: "Add cost" }));
  type("Label", "Refund");
  type("Amount", "-50");
  fireEvent.submit(screen.getByRole("form", { name: "New cost" }));

  expect(await screen.findByText("Must be 0 or more.")).toBeTruthy();
  expect(screen.getByLabelText("Amount").className).toContain("border-loss");
  expect(onChanged).not.toHaveBeenCalled();
});

test("editing a cost patches it and refreshes", async () => {
  const { fetchMock, onChanged } = renderCosts(Response.json({ id: 4 }));

  fireEvent.click(screen.getByRole("button", { name: "Edit Shipping" }));
  expect((screen.getByLabelText("Amount") as HTMLInputElement).value).toBe(
    "₱350.00",
  );
  type("Amount", "400");
  fireEvent.submit(screen.getByRole("form", { name: "Edit Shipping" }));

  await waitFor(() => expect(onChanged).toHaveBeenCalled());
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/extra-costs/4/");
  expect(init.method).toBe("PATCH");
  expect(JSON.parse(init.body)).toEqual({ label: "Shipping", amount: "400" });
  expect(screen.queryByRole("form")).toBeNull();
});

test("Esc discards the edit", () => {
  const { fetchMock } = renderCosts(Response.json({}));

  fireEvent.click(screen.getByRole("button", { name: "Edit Shipping" }));
  type("Label", "Something else");
  fireEvent.keyDown(screen.getByLabelText("Label"), { key: "Escape" });

  expect(screen.queryByRole("form")).toBeNull();
  expect(screen.getByText("Shipping")).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("deleting a cost sends DELETE and refreshes", async () => {
  const { fetchMock, onChanged } = renderCosts(
    new Response(null, { status: 204 }),
  );

  fireEvent.click(screen.getByRole("button", { name: "Delete Platform fee" }));

  await waitFor(() => expect(onChanged).toHaveBeenCalled());
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/extra-costs/5/");
  expect(init.method).toBe("DELETE");
});
