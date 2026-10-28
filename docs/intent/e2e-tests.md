# Intent: End-to-end tests

Confirmed 2026-10-28.

- **Outcome:** A Playwright test that runs the manual click-through: sign up, create a build, add loose parts, add a bundle with a part inside, set a selling price, check totals, profit and checklist, delete the build. Then the same at phone width (375px).
- **User:** The author after any change, and anyone reviewing a PR.
- **Why now:** Bundles made the flow long enough that clicking through by hand is slow and easy to skip.
- **Success:** A third required CI check on every PR that goes red when the frontend and API stop working together, even with the unit tests green. No manual click-through before merging.
- **Constraint:** Runs against a local stack in CI (Postgres, Django, Vite) on a throwaway database, never the live site or Neon. One new dev dependency, `@playwright/test`. About 1–2 minutes per run. Written the way Playwright recommends: role and label locators, web-first assertions with no sleeps, a fresh user per run, `webServer` starting the stack, trace and screenshot kept on failure.
- **Out of scope:** Edge-case flows (unit tests cover them), screenshot comparison, live-site runs, a per-feature e2e suite, browsers other than Chromium, page-object classes.
