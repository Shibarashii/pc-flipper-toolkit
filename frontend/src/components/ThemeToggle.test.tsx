import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

const html = document.documentElement;

afterEach(() => {
  cleanup();
  delete html.dataset.theme;
  localStorage.removeItem("theme");
});

test("switches the theme and saves the choice", () => {
  render(<ThemeToggle />);

  // jsdom has no dark device setting, so it starts light.
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
