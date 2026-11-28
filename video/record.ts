// Records the live site for the demo video, with a log of every cursor move, click and step
// (specs/demo-video.md). Run with `npm run record`; writes recording/demo.mp4 and events.json.
//
// Playwright's video, Chrome's screencast and plain screenshots all capture 1280×720 whatever
// the scale, which blurs once the camera zooms in. A screenshot with a 2× clip is 2560×1440 at
// about 15 a second, so the recorder takes them one after another and stitches them. The
// cursor and camera are drawn at 30 fps by Remotion; only the page itself updates at ~15.
import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { chromium, expect, type Locator, type Page } from "@playwright/test";
import type { VideoEvent } from "./src/events.ts";

const SITE = "https://pc-flipper-toolkit.vercel.app";
const API = "https://pc-flipper-toolkit.onrender.com/api/schema/";
const VIEWPORT = { width: 1280, height: 720 };
const SCALE = 2;
const FPS = 30;
const OUT = "recording";
const FRAMES = `${OUT}/frames`;

/** Render's free plan sleeps; ask until it answers so the waking note never shows. */
async function wakeApi() {
  const until = Date.now() + 180_000;
  while (Date.now() < until) {
    try {
      if ((await fetch(API)).ok) return;
    } catch {
      // Still waking.
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`The API didn't answer within 3 minutes: ${API}`);
}

const events: VideoEvent[] = [];
let start = 0; // Date.now() in seconds, the clock the screencast's timestamps use
const now = () => Date.now() / 1000 - start;
let at = { x: 900, y: 520 };

const pause = (page: Page, ms: number) => page.waitForTimeout(ms);
const step = (n: number) => events.push({ t: now(), type: "step", step: n });

/** Moves the cursor like a hand: eased, logged at every point it passes. Paced by the clock,
 * so a move takes `ms` however long each mouse event waits behind the screenshots. */
async function moveTo(page: Page, x: number, y: number, ms = 600) {
  const from = at;
  const begin = now();
  for (;;) {
    const k = Math.min(1, ((now() - begin) * 1000) / ms);
    const e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2; // ease in-out
    at = { x: from.x + (x - from.x) * e, y: from.y + (y - from.y) * e };
    await page.mouse.move(at.x, at.y);
    events.push({ t: now(), type: "move", ...at });
    if (k === 1) return;
    await page.waitForTimeout(12);
  }
}

/** Scrolls with the wheel, a little at a time, until the element is well inside the window. */
async function reveal(page: Page, target: Locator) {
  const margin = 90;
  for (let i = 0; i < 200; i++) {
    const box = await target.boundingBox();
    if (!box) throw new Error(`Not on screen: ${target}`);
    const below = box.y + box.height - (VIEWPORT.height - margin);
    const above = margin - box.y;
    if (below <= 0 && above <= 0) return box;
    await page.mouse.wheel(0, below > 0 ? Math.min(30, below) : -Math.min(30, above));
    await pause(page, 20);
  }
  throw new Error(`Couldn't scroll to: ${target}`);
}

/** Moves to the middle of an element and clicks it there. */
async function click(page: Page, target: Locator, ms?: number) {
  const box = await reveal(page, target);
  await moveTo(page, box.x + box.width / 2, box.y + box.height / 2, ms);
  await pause(page, 120);
  await page.mouse.down();
  events.push({ t: now(), type: "click", ...at });
  await page.mouse.up();
}

/** Clicks a field and types into it key by key, or all at once when `fast`. */
async function typeInto(page: Page, field: Locator, text: string, fast = false) {
  await click(page, field, 450);
  if (fast) {
    await field.fill(text);
    events.push({ t: now(), type: "type", ...at });
    return;
  }
  for (const key of text) {
    await page.keyboard.type(key);
    events.push({ t: now(), type: "type", ...at });
    await pause(page, 35);
  }
}

/** Rests the cursor just right of something worth seeing (so it doesn't hide it), and the
 * camera goes in on it for `ms`. */
async function lookAt(page: Page, target: Locator, ms: number) {
  const box = await reveal(page, target);
  await moveTo(page, box.x + box.width + 24, box.y + box.height / 2, 600);
  const until = now() + ms / 1000;
  while (now() < until) {
    events.push({ t: now(), type: "look", ...at });
    await pause(page, 200);
  }
}

/** Points at a native select and picks an option (its own pop-up isn't in screenshots). */
async function choose(page: Page, select: Locator, label: string) {
  const box = await reveal(page, select);
  await moveTo(page, box.x + box.width / 2, box.y + box.height / 2, 450);
  await pause(page, 120);
  events.push({ t: now(), type: "click", ...at });
  await select.selectOption({ label });
}

/** Each frame stays until the next one came; the result is a constant 30 fps MP4. */
async function stitch(frames: { file: string; t: number }[], duration: number) {
  if (frames.length === 0) throw new Error("Chrome sent no frames");
  frames[0].t = 0; // the first frame also covers the moment before it arrived
  const list = frames.flatMap((f, i) => [
    `file '${f.file}'`,
    `duration ${((frames[i + 1]?.t ?? duration) - f.t).toFixed(4)}`,
  ]);
  list.push(`file '${frames[frames.length - 1].file}'`); // concat needs it for the last duration
  await writeFile(`${FRAMES}/list.txt`, list.join("\n"));
  // Remotion's own ffmpeg, so nothing else needs installing.
  execFileSync(
    "npx",
    ["remotion", "ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0",
     "-i", `${FRAMES}/list.txt`, "-r", String(FPS), "-fps_mode", "cfr",
     "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p", `${OUT}/demo.mp4`],
    { stdio: "inherit" },
  );
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await wakeApi();

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    colorScheme: "light",
  });
  // Copy listing writes to the clipboard; headless Chromium asks first otherwise.
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: SITE });
  const page = await context.newPage();
  await rm(FRAMES, { recursive: true, force: true });
  await mkdir(FRAMES, { recursive: true });

  await page.goto(SITE);
  await page
    .getByRole("heading", { name: "Track your profit on every PC you flip" })
    .waitFor();

  // The video starts on the loaded landing page, then screenshots one after another until the
  // steps are done, each with when it was asked for.
  const frames: { file: string; t: number }[] = [];
  const cdp = await context.newCDPSession(page);
  let recording = true;
  start = Date.now() / 1000;
  const capture = (async () => {
    while (recording) {
      const t = now();
      // A clip is measured from the top of the page, so it follows the scroll.
      const shot = await cdp
        .send("Page.getLayoutMetrics")
        .then(({ cssVisualViewport: { pageX, pageY } }) =>
          cdp.send("Page.captureScreenshot", {
            format: "jpeg",
            quality: 92,
            clip: { x: pageX, y: pageY, ...VIEWPORT, scale: SCALE },
          }),
        )
        .catch(() => null); // mid-paint; the next one will do
      if (!shot) continue;
      const { data } = shot;
      const file = `${String(frames.length).padStart(5, "0")}.jpg`;
      frames.push({ file, t });
      await writeFile(`${FRAMES}/${file}`, Buffer.from(data, "base64"));
    }
  })();
  try {
    await steps(page);
  } catch (e) {
    // A screenshot of where it stopped, to see why.
    recording = false;
    await capture;
    await page.screenshot({ path: `${OUT}/failed.png` }).catch(() => {});
    await browser.close();
    throw e;
  }

  const duration = now();
  recording = false;
  await capture;
  await browser.close();
  await stitch(frames, duration);
  await writeFile(
    `${OUT}/events.json`,
    JSON.stringify({ duration, scale: SCALE, events }, null, 1),
  );
  console.log(`Recorded ${duration.toFixed(1)} s → ${OUT}/demo.mp4, ${OUT}/events.json`);
}

/** The video's steps, from the loaded landing page (specs/demo-video.md#steps). */
async function steps(page: Page) {
  // Step 1: the landing page, then the hero's Try the demo.
  await page.mouse.move(at.x, at.y);
  events.push({ t: now(), type: "move", ...at });
  step(1);
  await pause(page, 900);
  await click(page, page.getByRole("button", { name: "Try the demo" }).first(), 900);

  // Step 2: the builds list, then the build in progress.
  const build = page
    .getByRole("link", { name: "i5-12400F + RTX 3060" })
    .filter({ visible: true });
  await build.waitFor();
  step(2);
  await pause(page, 700);
  await click(page, build);
  await page.getByRole("region", { name: "Summary", exact: true }).waitFor();
  await pause(page, 900);

  // Step 3: a bundle, bought for one price.
  step(3);
  await click(page, page.getByRole("button", { name: "Add bundle" }));
  const bundle = page.getByRole("form", { name: "New bundle" });
  await typeInto(page, bundle.getByPlaceholder("Bundle name"), "Board + PSU");
  await typeInto(page, bundle.getByPlaceholder("Shop"), "Facebook Marketplace");
  await typeInto(page, bundle.getByPlaceholder("Price ₱"), "7500");
  await click(page, bundle.getByRole("button", { name: "Save" }), 500);
  await bundle.waitFor({ state: "detached" });
  await pause(page, 500);

  // Step 4: a motherboard from today's shop prices, then a PSU typed in quickly.
  step(4);
  const addToBundle = page
    .getByRole("button", { name: "Add part to Board + PSU" })
    .filter({ visible: true });
  await click(page, addToBundle);
  // After a save the app opens a fresh form in the same bundle, for the next part.
  const part = page.getByRole("form", { name: "New part" });
  const name = part.getByRole("combobox", { name: "Part" });
  await typeInto(page, name, "H610M");
  const inStock = page
    .getByRole("listbox", { name: "Shop products" })
    .getByRole("option")
    .filter({ hasNotText: "Out of stock" })
    .first();
  await inStock.waitFor({ timeout: 15_000 }).catch(() => {
    throw new Error('No in-stock "H610M" in today\'s shop copy: change the search word in record.ts');
  });
  await pause(page, 700);
  await click(page, inStock, 550);
  await pause(page, 300);
  await choose(page, part.getByLabel("Category"), "Motherboard");
  await click(page, part.getByRole("button", { name: "Save" }), 500);
  await expect(name).toHaveValue("");
  await pause(page, 300);

  await choose(page, part.getByLabel("Category"), "PSU");
  await typeInto(page, part.getByPlaceholder("Listed ₱"), "3000", true);
  // The name last: its shop search pops up as it's filled, and Enter saves the form anyway.
  await typeInto(page, name, "650W 80+ Bronze", true);
  await page.keyboard.press("Enter");
  await expect(name).toHaveValue("");
  await page.keyboard.press("Escape"); // the fresh form isn't needed
  await part.waitFor({ state: "detached" });
  await pause(page, 800);

  // Step 5: a selling price, then the profit it makes.
  step(5);
  const price = page.getByLabel("Selling price");
  await typeInto(page, price, "33000");
  await page.keyboard.press("Enter"); // saves on blur
  const summary = page.getByRole("region", { name: "Summary", exact: true });
  const margin = summary.getByText(/% margin$/);
  await margin.waitFor();
  await lookAt(page, summary.getByText(/^\+₱/), 1800);

  // Step 6: the listing, copied in one tap.
  step(6);
  await click(page, page.getByRole("button", { name: "Copy listing" }).filter({ visible: true }));
  const dialog = page.getByRole("dialog", { name: "Copy listing" });
  await pause(page, 900);
  await click(page, dialog.getByRole("button", { name: "Copy", exact: true }), 550);
  await dialog.getByText("Copied").waitFor();
  await pause(page, 1300);
}

await main();
