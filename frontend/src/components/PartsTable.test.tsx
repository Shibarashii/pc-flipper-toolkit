import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { EMPTY_TOTALS } from "../test/fixtures";
import { PartsTable } from "./PartsTable";

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
  type("Listed price", "12,500");
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

test("adding a part posts it (without thousands separators) and refreshes", async () => {
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
    Response.json(
      { bought_for: ["Price can't be negative."] },
      { status: 400 },
    ),
  );

  expect(await screen.findByText("Price can't be negative.")).toBeTruthy();
  expect(screen.getByLabelText("Bought for").className).toContain(
    "border-loss",
  );
  expect(onChanged).not.toHaveBeenCalled();
});
