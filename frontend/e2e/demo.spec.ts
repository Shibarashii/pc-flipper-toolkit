import { expect, test } from "@playwright/test";

test("try the demo: sample builds, then sign up instead", async ({ page }) => {
  await page.goto("/login");
  // Logged out, the header has room for the name at every width, and it's the only place
  // the log-in page shows it.
  const home = page.getByRole("link", { name: "PC Flipper Toolkit" });
  await expect(home.getByText("PC Flipper Toolkit")).toBeVisible();
  await page.getByRole("button", { name: "Try the demo" }).click();

  await expect(
    page.getByText("You’re trying a demo. It’s deleted after 24 hours."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Exit demo" })).toBeVisible();
  // The builds list has a table on desktop and cards on phones.
  const build = (name: string) =>
    page.getByRole("link", { name }).filter({ visible: true });
  await expect(build("i5-12400F + RTX 3060")).toBeVisible();

  // Logged in, the home link shows the logo always, the name beside it where it fits
  // (410px+).
  await expect(home.locator("img")).toBeVisible();
  await expect(home.getByText("PC Flipper Toolkit")).toBeVisible({
    visible: page.viewportSize()!.width >= 410,
  });

  // The smallest phones: the header (with "Exit demo", its longest button) fits a 320px
  // window, so the page doesn't scroll sideways.
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: 320, height: size.height });
  expect(
    await page.evaluate(
      "document.documentElement.scrollWidth - document.documentElement.clientWidth",
    ),
  ).toBe(0);
  await page.setViewportSize(size);

  await build("Ryzen 5 5600 + RX 6600").click();

  const summary = page.getByRole("region", { name: "Summary", exact: true });
  await expect(summary.getByText("+₱4,200.00")).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Build" })
      .getByText("6 of 6 required parts"),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Sign up for your own account" })
    .click();
  await expect(page.getByRole("heading", { name: "Sign up" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Exit demo" })).toBeHidden();
});
