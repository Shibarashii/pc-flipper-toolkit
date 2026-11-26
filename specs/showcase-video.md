# Spec: A 60-second showcase video

A silent, captioned video of the app for LinkedIn and Facebook, made with Remotion from the app's
own components. On top of [specs/app.md](app.md), which stays the source of truth. Intent:
[specs/intent/showcase-video.md](intent/showcase-video.md). Approved 2026-11-26.

## Objective

- **What:** a 60-second portrait MP4 (1080×1350, 4:5, 30 fps, 1,800 frames). It follows one
  flip from start to finish on the demo's sold build, then says who built it and how, then ends
  on "Try the demo". Nothing in it is a screen recording: each scene renders the app's real
  components with fixed data and animates them.
- **Why:** the app is finished and live, and the author wants to show it where people already
  are. A screen recording reads as a slideshow; animated components can move at the pace of a
  voice.
- **Users:** PC flippers and recruiters scrolling a feed, many with the sound off.

### User stories

1. Scrolling with the sound off, I understand from the captions alone what the app does for a
   flipper, and that someone built it.
2. As the author, I record my voice-over against the draft script below, and every line has room
   in its scene.
3. As the author, I change a caption or a scene's length in one place and render again in one
   command.

### Out of scope

Voice-over, music and sound effects (the author adds them). Landscape or square cuts. Account
pages, Google sign-in and emails. Uploading or posting. Any change to how the app behaves.

## The video

**Look:** the light theme (warm paper), the brand's tokens and fonts
([brand.md](design/brand.md)): Newsreader for captions, Instrument Sans for the UI. Each scene
has a **caption** at the top (Newsreader 500, 64px, up to two lines, `ink`) and a **phone** below
it: the app's phone layout at 390px wide, scaled up to fill the frame's width less 80px of margin
each side. The phone has the app's header and a hairline frame, not a device mockup. Captions
change with a 10-frame cross-fade; things inside the phone move with Remotion's `spring` (no
bounce) or `interpolate`, never a cut.

**Data:** the demo's sold build, as in [landingDemo.ts](../frontend/src/landingDemo.ts) and
[demo.py](../backend/builds/demo.py): "Ryzen 5 5600 + RX 6600", the "Board + CPU + RAM" bundle
(₱9,500, Facebook Marketplace), sold for ₱32,000, +₱4,200 profit, 13.13% margin. The builds list
also has the in-progress "i5-12400F + RTX 3060".

### Beats

Frames at 30 fps. The words in the narration column are a draft for the author to rewrite; each
fits its beat at about 2.5 words a second.

| # | Frames | Caption (on screen) | In the phone | Narration (draft) |
|---|---|---|---|---|
| 1 | 0–149 (5s) | What did your last flip really make you? | The build diagram, empty; parts drop into their slots one after another | "Flipping PCs? Quick question: what did your last build actually make you?" |
| 2 | 150–599 (15s) | Log every part, bundle and cost | Parts appear one by one with what was paid; three fold into the bundle; Shipping and Thermal paste go in as extra costs; the checklist counts up to "6 of 6 required parts" | "PC Flipper Toolkit tracks every flip. Add each part with what you paid, group the ones you bought as a bundle, and add the extras like shipping. The checklist shows what's still missing." |
| 3 | 600–869 (9s) | Check today's shop prices | "rx 6600" types into the price lookup; results from EasyPC and PC Express slide in; one is picked and fills the listed price | "Not sure what a part's worth? Search today's prices from EasyPC and PC Express, and pick one." |
| 4 | 870–1139 (9s) | Know your profit, to the peso | ₱32,000 types into the selling price; the summary counts up to +₱4,200 and 13.13% | "Set your selling price, and you see your profit and margin straight away." |
| 5 | 1140–1289 (5s) | Post the listing in one tap | The listing text appears and "Copied" shows | "Then copy a ready-made listing in one tap." |
| 6 | 1290–1439 (5s) | Every flip, every month | The builds list: both builds, and the month's totals above them | "And see every flip, and every month, at a glance." |
| 7 | 1440–1649 (7s) | Built from scratch by Seanrei Valdeabella | The phone slides out; the stack in a row of hairline chips: React, TypeScript, Tailwind CSS, Django REST Framework, PostgreSQL, live shop prices | "I built it from scratch: React and TypeScript, with Django and Postgres behind it." |
| 8 | 1650–1799 (5s) | Track your profit on every PC you flip | The logo, "Try the demo, no sign-up needed" and pc-flipper-toolkit.vercel.app | "Try the demo, no sign-up needed. Link below." |

The beat lengths live in one list in the code, so a beat that needs more room for the voice
changes there and every later beat moves with it.

**Price lookup results** are fixed sample rows, in the shape the API returns (`ShopProduct`):
one RX 6600 from each shop with a plausible price, in stock. They're marked in the code as
samples. The landing page already shows "RX 6600 ₱11,000", so the picked row uses that price.

## How it works

- **A separate package:** `video/` at the repository root, with its own `package.json`, outside
  `frontend/` and `backend/`. Vercel builds from `frontend/` and Render from `backend/`, so
  neither installs or builds it, and CI doesn't run it.
- **Remotion 4.0.547**, pinned like the frontend's packages: `remotion`, `@remotion/cli`,
  `@remotion/tailwind-v4`, `@remotion/google-fonts`, plus `react` and `react-dom` 19.3.1,
  `tailwindcss` 4.3.3 and `typescript`, all at the frontend's versions. Remotion is free for an
  individual (its licence FAQ).
- **The app's components, imported, not copied:** scenes import from `../frontend/src`
  (`BuildDiagram`, `BuildChecklist`, `PartItem`, `BundleItem`, `ProductFacts`, `Summary`,
  `BuildsSummary`, `StatusTag`, `listingText`, `buildSlots`, `formatMoney`, `SOLD_BUILD`). Where a
  piece only exists inside a page (the landing page's price tags), the video draws its own from
  the same tokens rather than changing the app.
- **`remotion.config.ts`** sets two things on the bundler:
  - Tailwind v4 (`enableTailwind`).
  - One React: `resolve.alias` sends `react` and `react-dom` to `video/node_modules`, because
    files under `frontend/src` would otherwise load the frontend's own copy, and two Reacts
    break hooks. `tsconfig.json`'s `paths` does the same for their types.
- **`import.meta.env`:** some component files import `api.ts`, which reads Vite's
  `import.meta.env` when it loads. Webpack compiles it to `undefined`, which `api.ts` already
  handles, so nothing defines it. The video makes no requests.
- **Styles:** `video/src/index.css` imports the frontend's `index.css` (the tokens and `@theme`),
  adds `@source "../../frontend/src"`, so Tailwind finds the components' classes, sets every
  breakpoint out of reach, so the components keep their phone layout in a 1080px frame, and sets
  `color-scheme: light`.
- **Fonts:** Instrument Sans and Newsreader through `@remotion/google-fonts`, loaded once before
  the first frame.
- **Animation state is a function of the frame:** each scene reads `useCurrentFrame()` and
  derives what's shown (how many parts are in, how much of "rx 6600" is typed, the counted-up
  profit). No timers, no `useEffect`, so any frame renders the same on its own.

## Commands

From `video/`:

```
npm install
npm run studio        # remotion studio: preview with a timeline, http://localhost:3000
npm run still -- 450  # one frame as a PNG into out/, to check a beat
npm run render        # out/showcase.mp4 (H.264, --crf=18)
npm run typecheck     # tsc --noEmit
```

## Project Structure

```
video/
├── package.json         Remotion and React, pinned; the scripts above
├── remotion.config.ts   Tailwind, one React
├── tsconfig.json
├── .gitignore           node_modules/, out/
└── src/
    ├── index.ts         registerRoot
    ├── Root.tsx         The composition: 1080×1350, 30 fps, 1,800 frames
    ├── index.css        The frontend's tokens, plus @source for its components
    ├── beats.ts         The beat list: id, frames, caption (one place to retime)
    ├── Showcase.tsx     Series of beats, each a caption over a phone
    ├── Phone.tsx        The 390px phone frame with the app's header, scaled up
    ├── data.ts          The sample price lookup rows and the builds list's month totals
    └── scenes/          One file per beat: Hook, Parts, Prices, Profit, Listing, Builds,
                         Stack, End
```

`specs/app.md`'s project structure gets one line for `video/`. `out/` is never committed; the
MP4 goes wherever the author keeps it.

## Code Style

The frontend's: TypeScript, function components, Tailwind classes from the brand's tokens, no
hard-coded colours. A scene file holds its own timings relative to its beat's start, named
(`const typing = [20, 80]`), not magic numbers inline. Comments point here, `(specs/showcase-video.md)`.

## Testing Strategy

- No unit tests: the video is checked by looking at it.
- `npm run typecheck` passes.
- A still from the middle of each beat (frames 75, 375, 735, 1005, 1215, 1365, 1545, 1725) is
  looked at for clipped text, wrong numbers and anything that doesn't match the app.
- The rendered MP4 is watched twice, once muted (do the captions alone tell the story?) and
  once reading the narration draft aloud over it (does each line fit its beat?).
- The frontend's tests, lint and build still pass, since the video imports from it but doesn't
  change it.

## Boundaries

- **Always:** use the app's components and tokens for anything that's in the app; keep every
  frame a pure function of the frame number; keep the numbers the demo's.
- **Ask first:** any change under `frontend/` (even an export); a package beyond the list
  above; music or sound.
- **Never:** commit `out/` or an MP4; add `video/` to CI, Vercel or Render; make network
  requests while rendering; show a screen the app doesn't have.

## Success Criteria

1. `npm run render` produces a 60.0-second, 1080×1350, 30 fps H.264 MP4.
2. Muted, each beat's caption says what that beat shows, and the eight captions in order tell
   the whole story.
3. Every UI element on screen is the app's own component or matches it exactly, with the demo's
   numbers (₱9,500 bundle, ₱32,000 sold, +₱4,200, 13.13%).
4. Read aloud at a normal pace, each narration line ends before its beat does.
5. Nothing under `frontend/` or `backend/` changes, and the frontend's checks still pass.
6. The author would post it as it is.

## Decisions

Settled when the spec was approved, as written:

1. **Light, not dark:** warm paper stands out in a mostly white feed. Changing it later is one
   switch.
2. **The name on beat 7** is "Seanrei Valdeabella", as in the LICENSE.
3. **Sample prices, not a live search:** sample rows never go out of date; a real search would
   within a week.
