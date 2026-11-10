# Spec: Footer

A one-line footer on every page, on top of [SPEC.md](../../SPEC.md), which stays the source of
truth for everything else. Intent agreed in conversation on 2026-11-10.

## Objective

- **What:** a quiet footer at the bottom of every page, logged in or out:
  - "© 2026 Seanrei Valdeabella" on the left;
  - "Privacy · " and GitHub's logo on the right: the privacy page, and the public repo;
  - the two stacked on phones.
- **Why:**
  - The [privacy page](google-sign-in.md) is only linked from the bottom of the log-in page, so
    once you're logged in there's no way to reach it.
  - Someone looking around the app (a recruiter) sees who built it and where the code is.
- **Users:** every visitor; recruiters in particular.

### User stories

1. On any page, at the bottom, I see who made the app, and links to Privacy and GitHub.
2. On a short page (Log in, Account, Privacy, an empty builds list), the footer sits at the
   bottom of the window, not halfway up under the content.
3. On a long page (a build with many parts), the footer comes after the content, and I only
   see it once I scroll there.

### Out of scope

- A multi-column footer, Terms of service, a contact email (the privacy page has it), social
  links, a version number.
- A footer fixed to the screen while scrolling.

## Frontend

- **Layout** (`App.tsx`): the header, the demo banner, the page and the footer sit in a column
  at least as tall as the window (`min-h-dvh`, so phones' moving address bars don't hide it).
  The page part grows to fill the space, which pushes the footer to the bottom on short pages.
- **Footer** (a small `Footer` in `App.tsx`; it's ~15 lines and used once):
  - A hairline above (`border-line`), the same side padding as the header (`px-4 sm:px-10`).
  - Small muted text (13/18, `muted`), like the header's username.
  - From 640px: "© 2026 Seanrei Valdeabella" on the left, the links on the right. Below:
    stacked, left-aligned, the links first.
  - **GitHub** is GitHub's mark (16px, in a 24px target), named "GitHub" for screen readers,
    with no word on screen (changed 2026-11-10 at the author's request).
  - **Privacy** is a router link to `/privacy`. **GitHub** links to
    `https://github.com/Shibarashii/pc-flipper-toolkit` in the same tab, like any link.
  - The links are muted, ink on hover, with the brand's focus ring, separated by a `·`.
  - The year is fixed (2026, the year in the MIT licence), not today's year.
- **Log-in page:** its own "Privacy" link goes; the footer replaces it.

## Commands

Same as [SPEC.md](../../SPEC.md#commands): `npm test`, `npm run lint`, `npx tsc -b` and
`npx playwright test` in `frontend/`. No backend change.

## Project Structure

```
frontend/src/
  App.tsx                the column layout and Footer
  pages/Login.tsx        its Privacy link goes
  App.test.tsx           + the tests below
frontend/e2e/flip.spec.ts  + one footer check on the sign-up page
SPEC.md                  Screens: the footer
docs/brand-guidelines.md Components: Footer
```

## Testing Strategy

- **Frontend (unit):**
  - Logged out (log-in page) and logged in (builds list): the footer shows the © line, a
    Privacy link to `/privacy` and a GitHub link to the repo.
  - The existing "privacy page opens from the log-in page" test now uses the footer's link;
    there is exactly one Privacy link on the page.
- **E2E:** jsdom can't lay out a page, so the flip test, on its sign-up page, checks that the
  footer's bottom edge is the window's bottom edge. It runs at desktop and 375px, as the flip
  test already does. No new e2e file ([e2e intent](../intent/e2e-tests.md): no per-feature
  suites).
- **Screenshots:** Log in, a builds list and a long build page, at desktop and 375px, light
  and dark.

## Boundaries

- **Always:** one line on desktop; muted and small; links with focus rings; no layout shift.
- **Ask first:** more links or content, a fixed footer, changing the name line.
- **Never:** tracking or third-party widgets in the footer; anything fetched to show it.

## Success Criteria

1. Every page, logged in or out, shows the footer with "© 2026 Seanrei Valdeabella", Privacy
   and GitHub.
2. On short pages it sits at the bottom of the window; on long ones it comes after the
   content; it never covers anything.
3. It fits at 375px (stacked) and desktop (one line), light and dark.
4. Privacy is reachable while logged in; the log-in page has one Privacy link, in the footer.
5. All tests pass (frontend, e2e).

## Open Questions

None. Decided 2026-11-10: © with the author's name, Privacy and GitHub, stacked on phones, at
the bottom of the window on short pages, never fixed.
