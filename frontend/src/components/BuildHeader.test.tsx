import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { BuildDetail } from "../api";
import { makeBuild } from "../test/fixtures";
import { BuildHeader } from "./BuildHeader";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-26T10:00:00"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderHeader(build: BuildDetail, response = Response.json(build)) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  const onUpdated = vi.fn();
  // Like the build page: the saved build comes back down as the new prop.
  function Page() {
    const [current, setCurrent] = useState(build);
    return (
      <BuildHeader
        build={current}
        onUpdated={(saved) => {
          onUpdated(saved);
          setCurrent(saved);
        }}
      />
    );
  }
  render(<Page />);
  const sent = () => JSON.parse(fetchMock.mock.calls[0][1].body);
  return { fetchMock, onUpdated, sent };
}

test("switching to Sold fills in today's date and shows it", async () => {
  const saved = makeBuild({ status: "sold", sold_at: "2026-10-26" });
  const { onUpdated, sent } = renderHeader(makeBuild(), Response.json(saved));

  fireEvent.change(screen.getByLabelText("Status"), {
    target: { value: "sold" },
  });

  await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(saved));
  expect(sent()).toEqual({ status: "sold", sold_at: "2026-10-26" });
  expect((screen.getByLabelText("Sold on") as HTMLInputElement).value).toBe(
    "2026-10-26",
  );
});

test("switching away from Sold clears the date", async () => {
  const { onUpdated, sent } = renderHeader(
    makeBuild({ status: "sold", sold_at: "2026-10-18" }),
    Response.json(makeBuild({ status: "listed" })),
  );
  expect(screen.getByText("Build 02 · sold Oct 18, 2026")).toBeTruthy();

  fireEvent.change(screen.getByLabelText("Status"), {
    target: { value: "listed" },
  });

  await waitFor(() => expect(onUpdated).toHaveBeenCalled());
  expect(sent()).toEqual({ status: "listed", sold_at: null });
  expect(screen.queryByLabelText("Sold on")).toBeNull();
});

test("the selling price saves on blur, cleaned, and says so", async () => {
  const { onUpdated, sent } = renderHeader(makeBuild());
  const price = screen.getByLabelText("Selling price");

  fireEvent.change(price, { target: { value: "₱50,000" } });
  fireEvent.blur(price);
  expect(screen.getByRole("status").textContent).toBe("Saving…");

  await waitFor(() => expect(onUpdated).toHaveBeenCalled());
  expect(sent()).toEqual({ selling_price: "50000" });
  expect((price as HTMLInputElement).value).toBe("₱50,000.00");
  expect(screen.getByRole("status").textContent).toBe("Saved");
});

test("clearing the selling price sends null", async () => {
  const { onUpdated, sent } = renderHeader(
    makeBuild({ selling_price: "50000.00" }),
  );
  const price = screen.getByLabelText("Selling price");

  fireEvent.change(price, { target: { value: "" } });
  fireEvent.blur(price);

  await waitFor(() => expect(onUpdated).toHaveBeenCalled());
  expect(sent()).toEqual({ selling_price: null });
});

test("an unchanged price, or one restored with Esc, isn't saved", () => {
  const { fetchMock } = renderHeader(makeBuild({ selling_price: "50000.00" }));
  const price = screen.getByLabelText("Selling price") as HTMLInputElement;

  fireEvent.change(price, { target: { value: "50,000" } });
  fireEvent.blur(price);
  fireEvent.change(price, { target: { value: "1" } });
  fireEvent.keyDown(price, { key: "Escape" });
  fireEvent.blur(price);

  expect(price.value).toBe("₱50,000.00");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("a negative price shows the error on the field", async () => {
  const { onUpdated } = renderHeader(
    makeBuild(),
    Response.json({ selling_price: ["Must be 0 or more."] }, { status: 400 }),
  );
  const price = screen.getByLabelText("Selling price");

  fireEvent.change(price, { target: { value: "-1" } });
  fireEvent.blur(price);

  expect(await screen.findByText("Must be 0 or more.")).toBeTruthy();
  expect(price.className).toContain("border-loss");
  expect(onUpdated).not.toHaveBeenCalled();
  // The field shows the problem, so the save status stays quiet.
  expect(screen.getByRole("status").textContent).toBe("");
});

test("renaming saves the new name on Enter", async () => {
  const { onUpdated, sent } = renderHeader(makeBuild());

  fireEvent.click(screen.getByRole("button", { name: "Rename build" }));
  const name = screen.getByLabelText("Build name");
  fireEvent.change(name, { target: { value: "  Budget 1080p  " } });
  fireEvent.keyDown(name, { key: "Enter" });

  await waitFor(() => expect(onUpdated).toHaveBeenCalled());
  expect(sent()).toEqual({ name: "Budget 1080p" });
});

test("Esc cancels a rename", () => {
  const { fetchMock } = renderHeader(makeBuild());

  fireEvent.click(screen.getByRole("button", { name: "Rename build" }));
  const name = screen.getByLabelText("Build name");
  fireEvent.change(name, { target: { value: "Something else" } });
  fireEvent.keyDown(name, { key: "Escape" });
  fireEvent.blur(name);

  expect(screen.getByRole("heading").textContent).toBe(
    "Ryzen 5 7600 + RTX 4060",
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

test("a failed switch away from Sold keeps the sold date", async () => {
  renderHeader(
    makeBuild({ status: "sold", sold_at: "2026-10-18" }),
    Response.json({}, { status: 500 }),
  );

  fireEvent.change(screen.getByLabelText("Status"), {
    target: { value: "listed" },
  });

  expect(await screen.findByRole("alert")).toBeTruthy();
  expect((screen.getByLabelText("Sold on") as HTMLInputElement).value).toBe(
    "2026-10-18",
  );
});

test("Esc on a rejected price also clears its error", async () => {
  renderHeader(
    makeBuild(),
    Response.json({ selling_price: ["Must be 0 or more."] }, { status: 400 }),
  );
  const price = screen.getByLabelText("Selling price");
  fireEvent.change(price, { target: { value: "-1" } });
  fireEvent.blur(price);
  await screen.findByText("Must be 0 or more.");

  fireEvent.keyDown(price, { key: "Escape" });

  expect(screen.queryByText("Must be 0 or more.")).toBeNull();
  expect(price.className).not.toContain("border-loss");
});
