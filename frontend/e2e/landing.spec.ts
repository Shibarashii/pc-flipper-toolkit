// On desktop the landing page's hero fills the first screen (docs/intent/landing-hero-height.md).
import { expect, test, type Page } from "@playwright/test";

test.skip(({ isMobile }) => isMobile, "phones keep the stacked hero");

/** The hero's picture and the first block's heading, in viewport pixels. */
async function measure(page: Page) {
  const header = await page.getByRole("banner").boundingBox();
  const picture = await page
    .getByRole("img", { name: /^A sold build/ })
    .boundingBox();
  const nextHeading = await page
    .getByRole("heading", { name: "Every flip, part by part" })
    .boundingBox();
  return {
    headerBottom: header!.y + header!.height,
    pictureTop: picture!.y,
    pictureBottom: picture!.y + picture!.height,
    nextHeadingTop: nextHeading!.y,
  };
}

test("on a tall desktop screen the hero fills it, centered, and the next block waits below", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1875, height: 935 });
  await page.goto("/");
  const m = await measure(page);
  expect(m.nextHeadingTop).toBeGreaterThanOrEqual(935);
  const above = m.pictureTop - m.headerBottom;
  const below = 935 - m.pictureBottom;
  expect(Math.abs(above - below)).toBeLessThanOrEqual(2);
});

test("at 1280×720 the hero still fits, as designed", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  const m = await measure(page);
  expect(m.pictureBottom).toBeLessThanOrEqual(720);
});

test("on a very tall screen the hero stops growing", async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/");
  const m = await measure(page);
  // Capped: the content doesn't float in the middle of a 1440px screen.
  expect(m.pictureTop - m.headerBottom).toBeLessThan(250);
});
