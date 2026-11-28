# Spec: A 35-second demo video

A silent, captioned demo video of the live site for LinkedIn, made with Remotion from a real
recording. On top of [specs/app.md](app.md), which stays the source of truth. Intent:
[specs/intent/demo-video.md](intent/demo-video.md). Approved 2026-11-28.

## Objective

- **What:** a 35-second landscape MP4 (1920×1080, 16:9, 30 fps, about 1,050 frames). A
  recording of the live site at desktop size, shown in a browser window on the brand's paper
  background, the whole window always on screen (no zoom), with a large cursor with a ripple
  on every click, and one short caption per step.
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
4. As the author, I change a caption or a step's length in one place.

### Out of scope

A voiceover, music and sound effects (the author can add music when posting). Phone-sized,
4:5 or square cuts. Sign-up, Google sign-in and account pages. Uploading or posting.
Any change to the app itself.

## The video

### Steps

Times are approximate; the recording sets the real timing. The whole window is on screen
throughout; there is no zoom (removed 2026-11-28, see Decided).

| # | Time | Caption | On screen |
|---|---|---|---|
| 1 | 0–3 s | Flip PCs? Know what each one really made you. | The landing page; the cursor moves to the hero's **Try the demo** and clicks |
| 2 | 3–6 s | Every flip in one place | The builds list; the cursor clicks **i5-12400F + RTX 3060** |
| 3 | 6–11 s | Bought a bundle? Log it as one price. | **Add bundle**: "Board + PSU", Facebook Marketplace, ₱7,500 is typed; Save |
| 4 | 11–19 s | Check today's shop prices | **Add part to Board + PSU**: "H610M" is typed and the shop results pop up under the name; a real in-stock one is picked and fills the name, Listed price and Shop; Motherboard; Save. Then the PSU, its category and listed price go in quickly; Save |
| 5 | 19–25 s | Know your profit, to the peso | The selling price is set in the build header; the Summary shows the profit and margin |
| 6 | 25–29 s | Post the listing in one tap | **Copy listing**, then **Copy**; "Copied" shows |
| 7 | 29–34 s | Track your profit on every PC you flip | An end card on paper: the logo, "Try the demo, no sign-up needed" and pc-flipper-toolkit.vercel.app |

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
- **Captions:** Newsreader, large, `ink` on a paper pill at the bottom of the frame, under
  the window. They fade between steps.
  Each step lasts at least its caption's reading time (a second, plus 3 words a second, plus
  the fades); the recorder holds a step until then.

### Data

The demo account's in-progress build "i5-12400F + RTX 3060" (Intel Core i5-12400F, RTX 3060
12GB, 16GB DDR4), as made by [demo.py](../backend/builds/demo.py). A bundle is added to it:
"Board + PSU" from Facebook Marketplace for ₱7,500, holding a motherboard and a "650W 80+
Bronze" PSU (listed ₱3,000). Bundled parts' bought-for is optional, so neither is typed. The
motherboard is the first in-stock result for "H610M" in the live shop copy on the day of
recording, so the video shows a real price. The PSU is typed quickly (the recorder fills it
instead of typing key by key), so it doesn't slow the step down.
The selling price is chosen so the profit is positive.

## How it works

- **Two steps, two commands:**
  1. **Record:** a Playwright script drives Chromium on the live site at a 1280×720 viewport,
     2× device scale, light colour scheme. It takes screenshots one after another at 2560×1440
     (about 15 a second) and stitches them into a constant 30 fps MP4 with Remotion's ffmpeg,
     plus an event log (`events.json`): every cursor position, click and step start, with its
     time. The cursor moves with Playwright's `mouse.move` in eased steps, each one logged, so
     it travels like a hand would, not in jumps. Capture starts once the landing page has
     loaded.
  2. **Render:** Remotion plays the recording and draws the frame, cursor, ripples and
     captions from the event log.
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
- **One place to change things:** `video/src/steps.ts` holds each step's caption; the recorder's pauses live in `video/record.ts`.
- **Output:** `video/out/demo.mp4` (H.264). The recording and the render are not committed.

## Commands

From `video/`:

```
npm install
npx playwright install chromium   # one-time, if the frontend's isn't there
npm run record                     # records the live site → recording/demo.mp4 + events.json
npm run studio                     # preview in Remotion Studio
npm run render                     # → out/demo.mp4
npm test                           # vitest run: the cursor and caption maths
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
    Demo.tsx             puts the frame, recording, cursor and captions together
    steps.ts             the caption per step (the one file to edit)
    Cursor.tsx           the cursor and click ripples
    Caption.tsx, EndCard.tsx, Window.tsx
```

## Code Style

As in [app.md](app.md#code-style): TypeScript, function components, named exports, comments
pointing to this spec. The cursor's and captions' maths stay plain functions of the time and the
event log, so they can be tested without rendering:

```ts
/** The caption at time t, faded at step changes (specs/demo-video.md). */
export function captionAt(t: number, events: VideoEvent[]): { text: string; opacity: number } {
  // ...
}
```

## Testing Strategy

- **The cursor and caption maths:** a few Vitest tests in `video/src/` (`npm test`): the
  cursor is at the logged position on a click, and captions fade at step changes.
- **The recorder:** it fails loudly if a step's element isn't there (Playwright's own waits),
  so a changed site breaks the recording, not the video.
- **By eye:** stills of a frame in each step (`npx remotion still`), then the full render,
  checked by the author.
- The app's own tests and CI are untouched.

## Boundaries

- **Always:** record through Try the demo; wake the API before recording; keep captions in
  `steps.ts`; pin versions.
- **Ask first:** any dependency beyond the ones above; music or voice; recording somewhere
  other than the live site; a second cut (phone, 4:5).
- **Never:** change the app to suit the video; sign up a real account or log in as the
  author; record more than a few runs in a minute; commit the recording or renders.

## Success Criteria

1. `npm run record` then `npm run render` produce a 1920×1080, 30 fps MP4 of 32–37 seconds.
2. It shows the seven steps in order on the live site, with real shop prices, and no waking
   note or error.
3. The cursor is visible in every frame of steps 1–6, and every click has a ripple.
4. ~~The camera zooms in on each click and typing area.~~ Dropped 2026-11-28: the whole
   window stays on screen.
5. Every caption is readable on a phone screen in the feed and on screen long enough to read.
6. The author watches it and finds it engaging, not a slideshow.

## Open Questions

None.

## Decided

- The end card shows only the logo, "Try the demo, no sign-up needed" and the link; no
  name (2026-11-28).
- The motherboard is the first in-stock "H610M" result on the day of recording (2026-11-28;
  "B660M" at first, but none of its 17 results was in stock that day, and H610M fits the
  build's i5-12400F, LGA 1700, too).
- A bundle is shown, in steps 3 and 4 (2026-11-28).
- **Step 4 uses the name field's pop-up, not Find prices** (T70, 2026-11-28): typing a part's
  name already pops up the shop results, so it's the app's quickest way to a real price, and
  it shows more on screen. Steps 3–4 came to about 16 s, not 13; the total still fits 32–37 s.
- **Recording sharpness** (T68, 2026-11-28): Playwright's video, Chrome's screencast and plain
  screenshots all capture 1280×720 whatever the device scale, which goes soft at 1.8×. A
  screenshot with a 2× clip is 2560×1440 at about 15 a second, sharp at 1.8×. So the recorder
  takes those; the page updates at ~15 fps while the cursor, drawn by Remotion, moves at 30.
- **No zoom** (T72, 2026-11-28): the author found the camera's zooms too distracting, so the
  camera was removed; the whole window stays on screen. The 2× recording stays, as the window
  is still scaled up to fill the 1080p frame.
- **Caption timing** (T72, 2026-11-28): the first caption went before the author could read
  it (2.8 s for 9 words). `readingTime` in `steps.ts` sets each step's minimum length, and the
  recorder waits for it before the next step. The recording came to 31.4 s, 36.4 s with the
  end card.
