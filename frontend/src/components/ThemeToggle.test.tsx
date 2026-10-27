import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

const html = document.documentElement;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete html.dataset.theme;
  localStorage.removeItem("theme");
});

test("switches the theme and saves the choice", () => {
  render(<ThemeToggle />);

  // The test setup's device is light, so it starts light.
  fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
  expect(html.dataset.theme).toBe("dark");
  expect(localStorage.getItem("theme")).toBe("dark");

  fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
  expect(html.dataset.theme).toBe("light");
  expect(localStorage.getItem("theme")).toBe("light");
});

test("starts from the saved choice", () => {
  html.dataset.theme = "dark";
  render(<ThemeToggle />);

  expect(
    screen.getByRole("button", { name: "Switch to light mode" }),
  ).toBeTruthy();
});

test("with nothing saved, starts from a dark device setting", () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(prefers-color-scheme: dark)",
  }));
  render(<ThemeToggle />);

  expect(
    screen.getByRole("button", { name: "Switch to light mode" }),
  ).toBeTruthy();
});
