import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { makeBuild } from "../test/fixtures";
import { Notes } from "./Notes";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderNotes(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  const onUpdated = vi.fn();
  render(<Notes build={makeBuild({ notes: "Old" })} onUpdated={onUpdated} />);
  return {
    fetchMock,
    onUpdated,
    textarea: screen.getByRole("textbox", { name: "Notes" }),
  };
}

test("notes save on blur and say so", async () => {
  const saved = makeBuild({ notes: "Paid via GCash" });
  const { fetchMock, onUpdated, textarea } = renderNotes(Response.json(saved));

  fireEvent.change(textarea, { target: { value: "Paid via GCash" } });
  fireEvent.blur(textarea);

  expect(await screen.findByText("Saved")).toBeTruthy();
  expect(onUpdated).toHaveBeenCalledWith(saved);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/builds/3/");
  expect(JSON.parse(init.body)).toEqual({ notes: "Paid via GCash" });
});

test("unchanged notes aren't saved", () => {
  const { fetchMock, textarea } = renderNotes(Response.json({}));

  fireEvent.blur(textarea);

  expect(fetchMock).not.toHaveBeenCalled();
});

test("a failed save says so", async () => {
  const { onUpdated, textarea } = renderNotes(
    Response.json({}, { status: 500 }),
  );

  fireEvent.change(textarea, { target: { value: "New" } });
  fireEvent.blur(textarea);

  expect(await screen.findByRole("alert")).toBeTruthy();
  await waitFor(() => expect(onUpdated).not.toHaveBeenCalled());
});
