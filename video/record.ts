// Records the live site for the demo video, with a log of every cursor move, click and step
// (specs/demo-video.md). Run with `npm run record`; writes recording/demo.mp4 and events.json.
//
// Playwright's video, Chrome's screencast and plain screenshots all capture 1280×720 whatever
// the scale, which blurs once the camera zooms in. A screenshot with a 2× clip is 2560×1440 at
// about 15 a second, so the recorder takes them one after another and stitches them. The
// cursor and camera are drawn at 30 fps by Remotion; only the page itself updates at ~15.
import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { chromium, type Locator, type Page } from "@playwright/test";
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

/** Moves the cursor like a hand: eased, logged at every point it passes. */
async function moveTo(page: Page, x: number, y: number, ms = 700) {
  const from = at;
  const n = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    const e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2; // ease in-out
    at = { x: from.x + (x - from.x) * e, y: from.y + (y - from.y) * e };
    await page.mouse.move(at.x, at.y);
    events.push({ t: now(), type: "move", ...at });
    await page.waitForTimeout(ms / n);
  }
}

/** Moves to the middle of an element and clicks it there. */
async function click(page: Page, target: Locator, ms?: number) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error(`Not on screen: ${target}`);
  await moveTo(page, box.x + box.width / 2, box.y + box.height / 2, ms);
  await pause(page, 150);
  await page.mouse.down();
  events.push({ t: now(), type: "click", ...at });
  await page.mouse.up();
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
  const page = await context.newPage();
  await rm(FRAMES, { recursive: true, force: true });
  await mkdir(FRAMES, { recursive: true });

  // Step 1: the landing page, then the hero's Try the demo.
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
      const shot = await cdp
        .send("Page.captureScreenshot", {
          format: "jpeg",
          quality: 92,
          clip: { x: 0, y: 0, ...VIEWPORT, scale: SCALE },
        })
        .catch(() => null); // mid-paint; the next one will do
      if (!shot) continue;
      const { data } = shot;
      const file = `${String(frames.length).padStart(5, "0")}.jpg`;
      frames.push({ file, t });
      await writeFile(`${FRAMES}/${file}`, Buffer.from(data, "base64"));
    }
  })();
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
  await pause(page, 1500);

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

await main();
