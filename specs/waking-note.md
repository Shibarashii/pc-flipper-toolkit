# Spec: Say when the API is waking up

A spinner while you wait to get in, and a note when the wait runs long. On top of
[specs/app.md](app.md), which stays the source of truth. Intent:
[specs/intent/waking-note.md](intent/waking-note.md). Approved 2026-11-21.

## Objective

- **What:** the buttons that start a session show a spinner and say what they're doing. After 5
  seconds of waiting, there or on a page that's still loading, a muted line says the server is
  waking up and can take up to a minute.
- **Why:** the API runs on Render's free plan and sleeps after 15 minutes idle, so the first
  request can take up to a minute. Today the button only fades and the page pulses, and the
  site looks stuck or broken.
- **Users:** everyone, first-time visitors trying the demo most of all.

### User stories

1. I press Try the demo on a cold server: the button reads "Starting the demo…" with a spinner
   at once, and after 5 seconds a line under it says why it's slow.
2. Same for Log in ("Logging in…"), Create account ("Creating account…") and Google sign-in
   ("Signing in with Google…", a line under Google's button, which isn't ours to change).
3. I open my builds, a build or Account on a cold server: the skeleton pulses as today, and
   after 5 seconds the same line shows above it.
4. A fast answer (under 5 seconds) never shows the line.

### Out of scope

- Saves, deletes, dialogs, price lookups: they follow a page that already loaded, so the server
  is awake.
- A timeout, a retry, or pinging the server to keep it awake.

## The words

| Where | While waiting | After 5 s |
|---|---|---|
| Log in button | Logging in… | the note, under the button |
| Create account button | Creating account… | the note, under the button |
| Google sign-in | Signing in with Google… (a line under Google's button) | the note, under that line |
| Try the demo (log-in page, landing hero, landing closing band) | Starting the demo… | the note, under the buttons |
| A page's skeleton (builds list, build, account, verify email) | the skeleton, as today | the note, above the skeleton |

**The note:** "Waking up the server — this can take up to a minute. It runs on Render’s free
plan, which sleeps when nobody’s using it."

## The look

From [brand.md](design/brand.md): no new color.

- **Spinner:** 14px, a ring in `currentColor` at 25% with a quarter arc at full, so it takes
  the button's text color (`on-accent` on the primary button, `ink` on the secondary). It sits
  before the words, 8px apart, and the button keeps its size. It spins with `animate-spin` and
  stands still under reduced motion (the words still say it's working). Hidden from screen
  readers.
- **The note:** `small` (13/18) in `muted`, like the demo's line on the log-in page; 12px from
  what it follows. A polite live region (`role="status"`), so a screen reader hears it once.
- A skeleton's note sits above its blocks, so it's in view on a phone even when the skeleton is
  taller than the screen.

## How it works

**Frontend only, no API change, no dependency.**

- `components/Waiting.tsx`: `Spinner`; `useSlow(active)`, true once `active` has held for
  5 seconds; `WakingNote`, the line.
- `Skeleton` shows `WakingNote` above its blocks after 5 seconds. `BuildsSummary`'s skeleton,
  on the same page as the builds list's, passes `note={false}` so the line shows once.
- `Login` remembers which way in is running (form, Google or demo) so only that one spins and
  gets the note. `Landing`'s `WaysIn` does the same for its Try the demo.

## Commands

Same as [specs/app.md](app.md#commands): `npm test`, `npm run lint`, `npx tsc -b` and
`npm run e2e` in `frontend/`.

## Project Structure

```
frontend/src/components/Waiting.tsx       Spinner, useSlow, WakingNote
frontend/src/components/Waiting.test.tsx  useSlow's 5 seconds
frontend/src/components/Skeleton.tsx      the note above the blocks
frontend/src/components/BuildsSummary.tsx note={false}
frontend/src/pages/Login.tsx              working words, spinner, note
frontend/src/pages/Landing.tsx            the same for Try the demo
frontend/src/App.test.tsx, pages/*.test.tsx  the tests below
specs/app.md                              one line on the loading states
```

## Code Style

```tsx
const slow = useSlow(saving === "demo");
<button disabled={!!saving} className={`w-full ${buttonSecondary}`}>
  {saving === "demo" ? <Working>Starting the demo…</Working> : "Try the demo"}
</button>
{slow && <WakingNote />}
```

## Testing Strategy

- **Vitest, fake timers:** for log in, sign up and Try the demo (log-in page and landing),
  a request that doesn't answer shows the working words at once, no note at 4.9 s, the note at
  5 s; when it answers, the note goes. A skeleton shows the note after 5 s and not before; the
  builds list shows it once. Google's flow is covered by `Login`'s state, as its button is
  Google's script and isn't rendered in tests.
- **E2E:** none new: a cold server can't be staged in CI ([e2e intent](intent/e2e-tests.md)).
- **Manual:** each with a slowed request (DevTools throttling or a paused `runserver`), at
  desktop and 375px, light and dark, and with reduced motion.

## Boundaries

- **Always:** the words above; the note only after 5 s.
- **Ask first:** a note on any other wait; a timeout or retry; a keep-alive ping.
- **Never:** a new dependency; a color outside the brand.

## Success Criteria

1. Log in, sign up, Google sign-in and Try the demo show their working words (and a spinner on
   our buttons) at once, and the note after 5 seconds of waiting.
2. The builds list, a build, Account and verify email show the note above their skeleton after
   5 seconds, once per page.
3. A wait under 5 seconds looks as it does today, apart from the button's words and spinner.
4. All tests pass; checked on the live site after a cold start, at desktop and 375px, light and
   dark.

## Open Questions

None. The design is on **Ready for development**, section "Waking note" (`180:7060`): Log in
while starting the demo (desktop and mobile) and while logging in, and the builds list loading,
each with the note, light and dark; approved 2026-11-21. Local components gained `Spinner`
(`180:82`) and Button `state=working` (primary `180:83`, secondary `180:88`).
