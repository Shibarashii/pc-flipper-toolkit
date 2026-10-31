import { expect, test, type Page } from "@playwright/test";

// One demo login shared by the whole file, in order: logging in is limited to 10 a minute,
// and the other e2e files use most of them. Only the last test saves anything.
test.describe.configure({ mode: "serial" });

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await page.goto("/login");
  await page.getByRole("button", { name: "Try the demo" }).click();
  await page
    .getByRole("link", { name: "i5-12400F + RTX 3060" })
    .filter({ visible: true })
    .click();
});

test.afterAll(() => page.close());

/** Opens the demo's RTX 3060 for editing. */
async function editPart() {
  await page
    .getByRole("button", { name: "Edit RTX 3060 12GB" })
    .filter({ visible: true })
    .click();
  return page.getByRole("form", { name: "Edit RTX 3060 12GB" });
}

// jsdom doesn't submit a form on Enter, so only a real browser can prove that Enter in
// the price search searches instead of saving the part. Works with or without a shop
// copy in the database (CI's has none).
test("price lookup: Enter searches and never saves the part", async () => {
  const form = await editPart();
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

  await form.getByRole("button", { name: "Cancel" }).click();
});

// The search is answered from a fixture: CI's database has no shop copy.
test.describe("part search pop-up", () => {
  const SHORT_NAME = "MSI RTX 3060 VENTUS 2X OC 12GB";

  test.beforeAll(() =>
    page.route("**/api/prices/?*", (route) =>
      route.fulfill({
        json: {
          results: [
            {
              shop: "PC Express",
              title:
                "MSI GeForce RTX™ 3060 VENTUS 2X OC 12GB GDDR6 192-bit Graphics Card",
              short_title: SHORT_NAME,
              url: "https://pcx.com.ph/products/msi-rtx-3060",
              price: "26000.00",
              in_stock: true,
            },
          ],
          updated_at: "2026-10-29T12:18:25+08:00",
        },
      }),
    ),
  );

  test("Down and Enter fill the fields and don't save", async () => {
    const form = await editPart();
    const box = form.getByRole("combobox", { name: "Part" });
    await box.fill("rtx 3060");
    await expect(form.getByRole("listbox")).toBeVisible();

    await box.press("ArrowDown");
    await box.press("Enter");

    await expect(box).toHaveValue(SHORT_NAME);
    await expect(form.getByLabel("Listed price")).toHaveValue("₱26,000.00");
    await expect(form.getByLabel("Shop")).toHaveValue("PC Express");
    await expect(form.getByRole("listbox")).toBeHidden();
    await expect(box).toBeFocused();
    // The cursor is at the end, ready to trim the name.
    await expect(box).toHaveJSProperty("selectionStart", SHORT_NAME.length);

    await form.getByRole("button", { name: "Cancel" }).click();
  });

  test("clicking a row fills the fields", async () => {
    const form = await editPart();
    const box = form.getByRole("combobox", { name: "Part" });
    await box.fill("rtx 3060");

    await form.getByRole("listbox").getByRole("option").click();

    await expect(box).toHaveValue(SHORT_NAME);
    await expect(form.getByLabel("Shop")).toHaveValue("PC Express");
    await expect(box).toBeFocused();

    await form.getByRole("button", { name: "Cancel" }).click();
  });

  test("Enter with no active row saves the part", async () => {
    const form = await editPart();
    const box = form.getByRole("combobox", { name: "Part" });
    await box.fill("RTX 3060 typed");
    await expect(form.getByRole("listbox")).toBeVisible();

    await box.press("Enter");

    await expect(form).toBeHidden();
    await expect(
      page
        .getByRole("region", { name: "Parts" })
        .getByText("RTX 3060 typed", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
  });
});
