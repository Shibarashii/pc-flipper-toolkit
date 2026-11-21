// The README's screenshots (docs/images/), taken from the running app with a fresh demo
// account, so nothing personal shows. Needs the API on 8000 and Vite on 5173, with shop prices
// in the local database for the price lookup (`manage.py refresh_shop_prices`).
//
//   cd frontend && node scripts/readme-screenshots.mjs
//
// Each run makes a demo account (log-ins are limited to 10 a minute).
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const OUT = new URL("../../docs/images/", import.meta.url).pathname;
const SOLD = "Ryzen 5 5600 + RX 6600";

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

/** A page logged in to a new demo account, on the sold build, in one theme. */
async function soldBuild(colorScheme, context) {
  const page = await (context ?? (await newContext(colorScheme))).newPage();
  await page.goto(BASE);
  await page.getByRole("button", { name: "Try the demo" }).first().click();
  await page.getByRole("link", { name: SOLD }).filter({ visible: true }).click();
  await page.getByRole("heading", { name: "Summary" }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  return page;
}

const newContext = (colorScheme) =>
  browser.newContext({
    viewport: { width: 1280, height: 860 },
    deviceScaleFactor: 2,
    colorScheme,
    reducedMotion: "reduce",
  });

/** The box around some elements, with room around it, in page pixels (boundingBox() is in
 * window pixels, so add the scroll). */
async function around(page, locators, pad = 24) {
  const boxes = await Promise.all(locators.map((l) => l.boundingBox()));
  const [sx, sy] = await page.evaluate(() => [scrollX, scrollY]);
  const x = Math.min(...boxes.map((b) => b.x)) - pad + sx;
  const y = Math.min(...boxes.map((b) => b.y)) - pad + sy;
  const right = Math.max(...boxes.map((b) => b.x + b.width)) + pad + sx;
  const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + pad + sy;
  return { x, y, width: right - x, height: bottom - y };
}

const shot = (page, name, clip) =>
  page.screenshot({ path: `${OUT}${name}.png`, clip, fullPage: !!clip });

// The build page, top: the README's first picture.
const light = await soldBuild("light");
await shot(light, "build-page", { x: 0, y: 0, width: 1280, height: 860 });

// Its Build section: the case filling up, beside the checklist.
const section = (name) =>
  light.locator("section").filter({ has: light.getByRole("heading", { name, exact: true }) });
await shot(light, "diagram", await around(light, [section("Build")]));

// The Summary, with the parts' prices it adds up beside it.
await shot(light, "summary", await around(light, [section("Summary")]));

// Copy listing: the build as a Marketplace post.
await light.getByRole("button", { name: "Copy listing" }).click();
const dialog = light.getByRole("dialog");
await dialog.waitFor();
// The dialog is fixed, so clip it in the window: a full-page shot would move it.
await light.screenshot({ path: `${OUT}listing.png`, clip: await dialog.boundingBox() });
await light.keyboard.press("Escape");

// Price lookup: editing a part, searching the shops.
await light.getByRole("button", { name: "Edit RX 6600 8GB" }).filter({ visible: true }).click();
const form = light.getByRole("form", { name: "Edit RX 6600 8GB" });
await form.getByRole("button", { name: "Find prices" }).click();
const box = form.getByLabel("Search the shops");
await box.fill("rx 6600");
await box.press("Enter");
const lookup = form.getByRole("group", { name: "Find prices" });
await lookup.getByText(/^Prices from/).waitFor();
// From the part's fields to the first few results.
const fields = await around(light, [form.getByLabel("Part", { exact: true }), lookup], 24);
await shot(light, "price-lookup", { ...fields, height: 620 });
await form.getByRole("button", { name: "Cancel" }).click();

// The builds list.
await light.getByRole("link", { name: "All builds" }).click();
await light.getByRole("heading", { name: "Builds", level: 1 }).waitFor();
await shot(light, "builds-list", { x: 0, y: 0, width: 1280, height: 440 });

// Light and dark: the build page split down the middle.
await light.getByRole("link", { name: SOLD }).filter({ visible: true }).click();
await light.getByRole("heading", { name: "Summary" }).waitFor();
const dark = await soldBuild("dark");
const halves = await Promise.all(
  [light, dark].map(async (page) =>
    (
      await page.screenshot({ clip: { x: 0, y: 0, width: 1280, height: 860 } })
    ).toString("base64"),
  ),
);
const split = await (await newContext("light")).newPage();
await split.setContent(`
  <style>body{margin:0} div{position:relative;width:1280px;height:860px}
  img{position:absolute;inset:0;width:1280px;height:860px}
  .light{clip-path:polygon(0 0,56% 0,44% 100%,0 100%)}</style>
  <div><img src="data:image/png;base64,${halves[1]}"><img class="light" src="data:image/png;base64,${halves[0]}"></div>`);
await shot(split, "light-and-dark");

await browser.close();
console.log(`Saved to ${OUT}`);
