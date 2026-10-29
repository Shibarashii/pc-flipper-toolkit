import { expect, test } from "@playwright/test";

// jsdom doesn't submit a form on Enter, so only a real browser can prove that Enter in
// the price search searches instead of saving the part. Works with or without a shop
// copy in the database (CI's has none).
test("price lookup: Enter searches and never saves the part", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Try the demo" }).click();
  await page
    .getByRole("link", { name: "i5-12400F + RTX 3060" })
    .filter({ visible: true })
    .click();
  await page
    .getByRole("button", { name: "Edit RTX 3060 12GB" })
    .filter({ visible: true })
    .click();
  const form = page.getByRole("form", { name: "Edit RTX 3060 12GB" });
  await form.getByRole("button", { name: "Find prices" }).click();

  const box = form.getByLabel("Search the shops");
  await expect(box).toHaveValue("RTX 3060 12GB");
  await box.fill("rtx 3060");
  await box.press("Enter");

  const lookup = form.getByRole("group", { name: "Find prices" });
  await expect(
    lookup.getByText(/^(Prices from|Prices aren’t loaded yet|No matches)/),
  ).toBeVisible();
  await expect(form).toBeVisible(); // still editing: nothing was saved

  await box.press("Escape");
  await expect(lookup).toBeHidden();
  await expect(form).toBeVisible();
});
