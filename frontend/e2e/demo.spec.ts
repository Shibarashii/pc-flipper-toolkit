import { expect, test } from "@playwright/test";

test("try the demo: sample builds, then sign up instead", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Try the demo" }).click();

  await expect(
    page.getByText("You’re trying a demo. It’s deleted after 24 hours."),
  ).toBeVisible();
  // The builds list has a table on desktop and cards on phones.
  const build = (name: string) =>
    page.getByRole("link", { name }).filter({ visible: true });
  await expect(build("i5-12400F + RTX 3060")).toBeVisible();
  await build("Ryzen 5 5600 + RX 6600").click();

  const summary = page.getByRole("region", { name: "Summary" });
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
  await expect(page.getByRole("button", { name: "Log out" })).toBeHidden();
});
