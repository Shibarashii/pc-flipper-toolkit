import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import type { BuildDetail, ExtraCost, Part } from "../api";
import { makeBuild } from "../test/fixtures";
import { DeleteBuildDialog } from "./DeleteBuildDialog";

beforeAll(() => {
  // jsdom doesn't implement modal dialogs.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const parts = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: i }) as Part);
const costs = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: i }) as ExtraCost);

function renderDialog(build: BuildDetail, response = Response.json({})) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  const onClose = vi.fn();
  render(
    <MemoryRouter initialEntries={["/builds/3"]}>
      <Routes>
        <Route
          path="/builds/:id"
          element={<DeleteBuildDialog build={build} onClose={onClose} />}
        />
        <Route path="/" element={<p>Builds list</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return { fetchMock, onClose };
}

test("names the build and how many parts and extra costs go with it", () => {
  renderDialog(
    makeBuild({ name: "Budget build", parts: parts(7), extra_costs: costs(1) }),
  );

  expect(
    screen.getByText(
      "“Budget build” and its 7 parts and 1 extra cost will be deleted. This can’t be undone.",
    ),
  ).toBeTruthy();
});

test("leaves out what the build doesn't have", () => {
  renderDialog(makeBuild({ name: "Empty", parts: parts(1) }));

  expect(
    screen.getByText(
      "“Empty” and its 1 part will be deleted. This can’t be undone.",
    ),
  ).toBeTruthy();
});

test("Delete build deletes it and goes back to the list", async () => {
  const { fetchMock } = renderDialog(
    makeBuild(),
    new Response(null, { status: 204 }),
  );

  fireEvent.click(screen.getByRole("button", { name: "Delete build" }));

  expect(await screen.findByText("Builds list")).toBeTruthy();
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/builds/3/");
  expect(init.method).toBe("DELETE");
});

test("a failed delete stays open and says so", async () => {
  renderDialog(makeBuild(), Response.json({}, { status: 500 }));

  fireEvent.click(screen.getByRole("button", { name: "Delete build" }));

  expect(await screen.findByRole("alert")).toBeTruthy();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Delete build" })).toHaveProperty(
      "disabled",
      false,
    ),
  );
});

test("Cancel closes it without deleting", () => {
  const { fetchMock, onClose } = renderDialog(makeBuild());

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(onClose).toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});
