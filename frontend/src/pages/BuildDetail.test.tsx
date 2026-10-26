import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, expect, test, vi } from "vitest";
import type { Part } from "../api";
import { makeBuild } from "../test/fixtures";
import { BuildDetail } from "./BuildDetail";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderAt(path: string, response: Response) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/builds/:id" element={<BuildDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

test("shows the build's number and name", async () => {
  renderAt("/builds/3", Response.json(makeBuild()));

  expect(await screen.findByText("Ryzen 5 7600 + RTX 4060")).toBeTruthy();
  expect(screen.getByText("Build 03")).toBeTruthy();
});

test("a 404 shows the not-found state", async () => {
  renderAt(
    "/builds/99",
    Response.json({ detail: "No Build matches" }, { status: 404 }),
  );

  expect(await screen.findByText("Build not found")).toBeTruthy();
});

test("a non-numeric id shows not-found without calling the API", async () => {
  renderAt("/builds/abc", Response.json({}));

  expect(await screen.findByText("Build not found")).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});

test("a refetch that read the database before a header save doesn't undo it", async () => {
  const part: Part = {
    id: 7,
    build: 3,
    name: "Ryzen 5 7600",
    category: "cpu",
    shop: "",
    listed_price: "1.00",
    bought_for: "1.00",
  };
  const before = makeBuild({ parts: [part] });
  const saved = makeBuild({ selling_price: "50000.00" });
  let gets = 0;
  let resolveStale = () => {};
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "DELETE")
        return Promise.resolve(new Response(null, { status: 204 }));
      if (init?.method === "PATCH")
        return Promise.resolve(Response.json(saved));
      gets += 1;
      if (gets === 2)
        // The refetch after the delete: it answers last, with pre-save data.
        return new Promise<Response>((resolve) => {
          resolveStale = () => resolve(Response.json(before));
        });
      return Promise.resolve(Response.json(gets === 1 ? before : saved));
    }),
  );
  render(
    <MemoryRouter initialEntries={["/builds/3"]}>
      <Routes>
        <Route path="/builds/:id" element={<BuildDetail />} />
      </Routes>
    </MemoryRouter>,
  );

  fireEvent.click(
    (await screen.findAllByRole("button", { name: "Delete Ryzen 5 7600" }))[0],
  );
  await waitFor(() => expect(gets).toBe(2));
  const price = screen.getByLabelText("Selling price");
  fireEvent.change(price, { target: { value: "50000" } });
  fireEvent.blur(price);
  expect(await screen.findByText("₱50,000.00")).toBeTruthy();

  await act(async () => resolveStale());

  expect(screen.getByText("₱50,000.00")).toBeTruthy();
});

test("a checklist Add link opens the add-part row with its category picked", async () => {
  renderAt("/builds/3", Response.json(makeBuild()));

  fireEvent.click(await screen.findByRole("button", { name: "Add PSU" }));

  const form = screen.getByRole("form", { name: "New part" });
  expect((form.querySelector("select") as HTMLSelectElement).value).toBe("psu");
  expect(screen.getByText("0 of 6 required parts")).toBeTruthy();
});
