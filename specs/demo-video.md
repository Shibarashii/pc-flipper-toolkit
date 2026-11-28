# Spec: A 35-second demo video

A silent, captioned demo video of the live site for LinkedIn, made with Remotion from a real
recording. On top of [specs/app.md](app.md), which stays the source of truth. Intent:
[specs/intent/demo-video.md](intent/demo-video.md). Approved 2026-11-28.

## Objective

- **What:** a 35-second landscape MP4 (1920×1080, 16:9, 30 fps, about 1,050 frames). A
  recording of the live site at desktop size, shown in a browser window on the brand's paper
  background, with a camera that zooms in to follow the cursor, a large cursor with a ripple on
  every click, and one short caption per step.
- **Why:** the app is finished and live. The showcase video removed in #141 animated rebuilt
  components and read as a slideshow; this one shows the real site, moving.
- **Users:** people scrolling LinkedIn (PC flippers, recruiters, developers), many with the
  sound off.

### User stories

1. Scrolling with the sound off, I can tell from the captions and the cursor alone what the
   app does for a flipper, and that it's a real, working site.
2. At every moment I can see where the cursor is and when it clicks.
3. As the author, I record the site again and render again with two commands, for example
   after the app changes.
4. As the author, I change a caption, a zoom or a step's length in one place.

### Out of scope

A voiceover, music and sound effects (the author can add music when posting). Phone-sized,
4:5 or square cuts. Sign-up, Google sign-in and account pages. Uploading or posting.
Any change to the app itself.

## The video

### Steps

Times are approximate; the recording sets the real timing. The camera zooms between 1× (the
whole window) and about 1.8× (the area around the cursor).

| # | Time | Caption | On screen | Camera |
|---|---|---|---|---|
| 1 | 0–3 s | Flip PCs? Know what each one really made you. | The landing page; the cursor moves to the hero's **Try the demo** and clicks | 1×, pushes in on the button just before the click |
| 2 | 3–6 s | Every flip in one place | The builds list; the cursor clicks **i5-12400F + RTX 3060** | Out to 1×, then in on the row |
| 3 | 6–11 s | Bought a bundle? Log it as one price. | **Add bundle**: "Board + PSU", Facebook Marketplace, ₱7,500 is typed; Save | In on the new bundle's row at about 1.6× |
| 4 | 11–19 s | Check today's shop prices | **Add part to Board + PSU**: a motherboard's name is typed, **Find prices**, a real in-stock result is picked and fills Listed price and Shop; Save. Then "650W 80+ Bronze" and its listed price go in quickly; Save | Follows the cursor and the typing at about 1.6×, out a little to show both parts inside the bundle |
| 5 | 19–25 s | Know your profit, to the peso | The selling price is set in the build header; the Summary shows the profit and margin | In on the selling price, then pans to the profit |
| 6 | 25–29 s | Post the listing in one tap | **Copy listing**, then **Copy**; "Copied" shows | In on the dialog |
| 7 | 29–34 s | Track your profit on every PC you flip | An end card on paper: the logo, "Try the demo, no sign-up needed" and pc-flipper-toolkit.vercel.app | Still |

The captions are drafts the author can rewrite in one file. Each is short enough to read in
the time its step is on screen.

### Look

- **Frame:** the brand's paper background ([brand.md](design/brand.md)), with the recording
  in a browser window in the middle: a hairline border, rounded corners and a thin bar on top
  showing `pc-flipper-toolkit.vercel.app`. No device mockup, no heavy shadow.
- **Theme:** the site in its light theme.
- **Cursor:** drawn by Remotion over the recording (a headless recording has no cursor): a
  large arrow, about 2× a normal one, `ink` with a paper-coloured outline so it shows on any
  background. Each click shrinks it briefly and sends out a green (`accent`) ripple.
- **Camera:** zooms and pans move with Remotion's `spring` (no bounce) or eased `interpolate`,
  never a cut. It never shows past the edges of the window.
- **Captions:** Newsreader, large, `ink` on a paper pill at the bottom of the frame, outside
  the zoom so they never move with the camera. They fade between steps.

### Data

The demo account's in-progress build "i5-12400F + RTX 3060" (Intel Core i5-12400F, RTX 3060
12GB, 16GB DDR4), as made by [demo.py](../backend/builds/demo.py). A bundle is added to it:
"Board + PSU" from Facebook Marketplace for ₱7,500, holding a motherboard and a "650W 80+
Bronze" PSU (listed ₱3,000). Bundled parts' bought-for is optional, so neither is typed. The
motherboard is the first in-stock result for "B660M" in the live shop copy on the day of
recording, so the video shows a real price. The PSU is typed quickly (the recorder fills it
instead of typing key by key), so it doesn't slow the step down.
The selling price is chosen so the profit is positive.

## How it works

- **Two steps, two commands:**
  1. **Record:** a Playwright script drives Chromium on the live site at a 1280×720 viewport,
     light colour scheme, and saves the recording plus an event log (`events.json`): every
     cursor position, click and step start, with its time. The cursor moves with Playwright's
     `mouse.move` in steps, so it travels like a hand would, not in jumps.
  2. **Render:** Remotion plays the recording and draws the frame, cursor, ripples, camera
     and captions from the event log.
- **The live site:** https://pc-flipper-toolkit.vercel.app through **Try the demo**. Before
  recording, the script asks the API (https://pc-flipper-toolkit.onrender.com) until it
  answers, so the waking note never shows. Each recording makes one demo account, which is
  deleted after 24 hours like any other. Log-in and the demo share a limit of 10 a minute, so
  a few runs in a row are fine.
- **A separate package:** `video/` at the repository root, with its own `package.json`,
  outside `frontend/` and `backend/`. Vercel and Render don't build it and CI doesn't run it.
- **Dependencies** (pinned, like the frontend's): `remotion`, `@remotion/cli`,
  `@remotion/google-fonts` at 4.0.547 (as the removed video used), `@playwright/test` at the
  frontend's 1.64.1, `react`/`react-dom` 19.3.1, `typescript` 6.0.3 and `vitest` 5.0.5. Remotion is free for an
  individual (its licence FAQ).
- **One place to change things:** `video/src/steps.ts` holds each step's caption and camera
  targets; the recorder's pauses live in `video/record.ts`.
- **Output:** `video/out/demo.mp4` (H.264). The recording and the render are not committed.

## Commands

From `video/`:

```
npm install
npx playwright install chromium   # one-time, if the frontend's isn't there
npm run record                     # records the live site → recording/demo.webm + events.json
npm run studio                     # preview in Remotion Studio
npm run render                     # → out/demo.mp4
npm test                           # vitest run: the camera and cursor maths
npm run lint                       # tsc --noEmit
```

## Project Structure

```
video/
  package.json, tsconfig.json, remotion.config.ts
  record.ts              the Playwright recorder: the steps, the pauses, the event log
  recording/             the last recording and events.json (git-ignored)
  out/                   renders (git-ignored)
  src/
    index.ts, Root.tsx   the Remotion entry and its one composition
    Demo.tsx             puts the frame, recording, camera, cursor and captions together
    steps.ts             captions and camera targets per step (the one file to edit)
    camera.ts            the zoom and pan at a given frame, from the event log
    Cursor.tsx           the cursor and click ripples
    Caption.tsx, EndCard.tsx, Window.tsx
```

## Code Style

As in [app.md](app.md#code-style): TypeScript, function components, named exports, comments
pointing to this spec. The camera's maths stays a plain function of the frame and the event
log, so it can be tested without rendering:

```ts
/** The camera at a frame: where it looks and how far in (specs/demo-video.md). */
export function cameraAt(frame: number, events: VideoEvent[], fps: number): Camera {
  // ...
}
```

## Testing Strategy

- **The camera and cursor maths:** a few Vitest tests in `video/src/` (`npm test`): the
  camera is 1× at the start, never shows past the window's edges at any frame, and the cursor
  is at the logged position on a click.
- **The recorder:** it fails loudly if a step's element isn't there (Playwright's own waits),
  so a changed site breaks the recording, not the video.
- **By eye:** stills of a frame in each step (`npx remotion still`), then the full render,
  checked by the author.
- The app's own tests and CI are untouched.

## Boundaries

- **Always:** record through Try the demo; wake the API before recording; keep captions and
  camera targets in `steps.ts`; pin versions.
- **Ask first:** any dependency beyond the ones above; music or voice; recording somewhere
  other than the live site; a second cut (phone, 4:5).
- **Never:** change the app to suit the video; sign up a real account or log in as the
  author; record more than a few runs in a minute; commit the recording or renders.

## Success Criteria

1. `npm run record` then `npm run render` produce a 1920×1080, 30 fps MP4 of 32–37 seconds.
2. It shows the seven steps in order on the live site, with real shop prices, and no waking
   note or error.
3. The cursor is visible in every frame of steps 1–6, and every click has a ripple.
4. The camera zooms in on each click and typing area and back out between steps, smoothly,
   never past the window's edges.
5. Every caption is readable on a phone screen in the feed and on screen long enough to read.
6. The author watches it and finds it engaging, not a slideshow.

## Open Questions

1. **Recording sharpness:** Playwright's video is a modest-quality WebM, and zooming in 1.8×
   may blur it. The first task checks this; if it's too soft, record at a 2× device scale
   factor, or fall back to frame-by-frame screenshots. Which fallback is chosen goes back into
   this spec.

## Decided

- The end card shows only the logo, "Try the demo, no sign-up needed" and the link; no
  name (2026-11-28).
- The motherboard is the first in-stock "B660M" result on the day of recording (2026-11-28).
- A bundle is shown, in steps 3 and 4 (2026-11-28).
