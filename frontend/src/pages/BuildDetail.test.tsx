import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, expect, test, vi } from "vitest";
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
