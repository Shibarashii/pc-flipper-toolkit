import { expect, test, type Page } from "@playwright/test";

/**
 * Fill and submit an open form, then wait for the saved row in `region`. The first field
 * is the row's name. Add rows stay open for the next entry, and the add-part submit reads
 * "Add part" on phones.
 */
async function fill(
  page: Page,
  form: string,
  fields: Record<string, string>,
  region = "Parts",
) {
  const f = page.getByRole("form", { name: form });
  for (const [label, value] of Object.entries(fields)) {
    // A <select> inside its <label> gets the options' text in the label too.
    if (label === "Category")
      await f
        .getByRole("combobox", { name: label })
        .selectOption({ label: value });
    else await f.getByLabel(label, { exact: true }).fill(value);
  }
  await f.getByRole("button", { name: /^(Save|Add part)$/ }).click();
  const name = Object.values(fields)[0];
  await expect(
    page
      .getByRole("region", { name: region })
      .getByText(name, { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
}

test("flip a PC: sign up, add parts and a bundle, price it, delete it", async ({
  page,
}, testInfo) => {
  // A fresh user each run, so runs never share data.
  const username = `e2e-${testInfo.project.name}-${Date.now()}`;
  await page.goto("/signup");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("No builds yet")).toBeVisible();

  await page.getByRole("button", { name: "New build" }).click();
  await page.getByLabel("Name").fill("Ryzen 5 7600 + RTX 4060");
  await page.getByRole("button", { name: "Create build" }).click();
  await expect(page).toHaveURL(/\/builds\/\d+$/);

  await page.getByRole("button", { name: "Add part", exact: true }).click();
  await fill(page, "New part", {
    Part: "Ryzen 5 7600",
    Shop: "PC Express",
    Category: "CPU",
    "Listed price": "12000",
    "Bought for": "10500",
  });
  await fill(page, "New part", {
    Part: "RTX 4060",
    Category: "GPU",
    "Listed price": "18000",
    "Bought for": "16000",
  });

  // A bundle's price counts once; its parts' own amounts are optional.
  await page.getByRole("button", { name: "Add bundle" }).click();
  await fill(page, "New bundle", {
    Bundle: "Board + RAM",
    Shop: "Villman",
    Price: "7500",
  });
  await page.getByRole("button", { name: "Add part to Board + RAM" }).click();
  await fill(page, "New part", {
    Part: "B650M",
    Category: "Motherboard",
    "Listed price": "6000",
    "Bought for": "4000",
  });
  await page.getByRole("button", { name: "Add part to Board + RAM" }).click();
  await fill(page, "New part", {
    Part: "32GB DDR5",
    Category: "RAM",
    "Listed price": "4500",
  });
  await expect(
    page
      .getByRole("list", { name: "Parts in Board + RAM" })
      .getByRole("listitem"),
  ).toHaveCount(2);
  await expect(
    page.getByText("₱3,500.00 not assigned").filter({ visible: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add cost" }).click();
  await fill(
    page,
    "New cost",
    { Label: "Shipping", Amount: "500" },
    "Extra costs",
  );

  const price = page.getByLabel("Selling price");
  await price.fill("38000");
  await price.blur();

  const summary = page.getByRole("region", { name: "Summary" });
  const value = (label: string) =>
    summary.locator(`dt:text-is("${label}") + dd`);
  await expect(summary.getByText("+₱3,500.00")).toBeVisible();
  await expect(summary.getByText("9.21% margin")).toBeVisible();
  await expect(value("Listed total")).toHaveText("₱40,500.00");
  await expect(value("Parts cost")).toHaveText("₱34,000.00");
  await expect(value("Extra costs")).toHaveText("₱500.00");
  await expect(value("Total cost")).toHaveText("₱34,500.00");

  const checklist = page.getByRole("region", { name: "Build" });
  await expect(checklist.getByText("3 of 6 required parts")).toBeVisible();
  await expect(checklist.getByRole("button", { name: "Add CPU" })).toHaveCount(
    0,
  );
  await expect(
    checklist.getByRole("button", { name: "Add PSU" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Delete build" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete this build?" });
  await expect(dialog).toContainText("its 4 parts, 1 bundle and 1 extra cost");
  await dialog.getByRole("button", { name: "Delete build" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("No builds yet")).toBeVisible();
});
