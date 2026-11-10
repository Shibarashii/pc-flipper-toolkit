# Implementation Plan: PC Flipper Toolkit v1

## Overview

The scaffold is done and on `main`: Django + DRF + Postgres, React + Vite + Tailwind, a
`Build` model, `GET/POST /api/builds/`, and a read-only builds list page. This plan builds
the rest of [SPEC.md](../SPEC.md) in small vertical slices. Each slice ends with something
you can click, in the spirit of "smallest working page first, then one feature at a time".

Full task details (acceptance criteria, verification, files) are in [todo.md](todo.md).

## Architecture Decisions

- **React Router (`react-router` v8, declarative mode).** `<BrowserRouter>` with two
  `<Route>`s (`/` and `/builds/:id`), plus `<Link>`, `useNavigate` and `useParams`. Chosen
  over hand-rolled routing because it's the industry standard and reads well on a resume.
  No data loaders or framework mode, since plain fetch in components is enough for v1.
- **Totals are computed on the model, in Python with Decimal** (SPEC: Code Style). The list
  endpoint uses `prefetch_related("parts", "extra_costs")` so the totals don't cause one
  query per build (N+1). Percentages are rounded to 2 places with `ROUND_HALF_UP`.
- **Two serializers.** Both return `totals`. The detail one also nests `parts` and
  `extra_costs`. The list one leaves out the nesting, since the list only shows totals.
- **Parts and extra costs have their own endpoints** (`/api/parts/`, `/api/extra-costs/`),
  using a plain `ModelViewSet` each, as in the SPEC. After a write, the frontend refetches the
  build so the totals always come from the server. No client-side math except the
  part-slot checklist, which the SPEC says lives in the frontend.
- **Accounts use DRF token auth** (`rest_framework.authtoken`, part of DRF). Each build has an
  `owner`, and every queryset is filtered to the logged-in user. Tokens rather than session
  cookies, because the frontend and API are on different sites, where browsers restrict
  cookies. This replaced the single-user access key (T11) once the app became multi-user.
  ponytail: DRF tokens never expire; logging out deletes them. Add expiry if that matters.
- **One branch per task** (`feat/<n>-<slug>`). It gets fast-forwarded into `main` once the
  task's verification passes.

## Dependency Graph

```
Build model (done)
 ├─ T1 routing + create build ─────────────── frontend only
 └─ T2 Part + ExtraCost models + totals
      └─ T3 detail API (nested + totals) + parts / extra-costs endpoints
           ├─ T4 detail page: parts + summary (read + add)
           │    ├─ T5 edit / delete parts
           │    ├─ T6 extra costs
           │    ├─ T7 header: status, selling price, sold date, notes
           │    ├─ T9 delete build
           │    └─ T10 build checklist
           └─ T8 list shows total cost + profit
                 └─ T11 access key (superseded) → T12 accounts API → T13 log in screens
                      └─ T14 deploy → T15 README
```
T1 and T2 are independent of each other. T5–T10 all depend on T4 but not on each other,
so their order is flexible.

## Task List

### Phase 1: Foundation
- [x] T1: Create a build from the list and land on its (stub) detail page
- [x] T2: Part and ExtraCost models with build totals
- [x] T3: Build detail API with nested parts, extra costs and totals

**Checkpoint 1:** all tests pass. You can create a build in the UI. `curl /api/builds/1/` shows `parts`, `extra_costs` and `totals`.

### Phase 2: Core flow, enough to log a real flip
- [x] T4: Detail page shows parts and the summary, and can add a part
- [x] T5: Edit and delete parts inline
- [x] T6: Extra costs: add, edit, delete
- [x] T7: Header: status, selling price, sold date, name, notes

**Checkpoint 2:** enter one real flip (≥ 6 parts, ≥ 2 extra costs). Profit matches your hand calculation to the centavo (SPEC success criterion 1). Review the UI together.

### Phase 3: Complete v1 locally
- [x] T8: Builds list shows total cost and profit
- [x] T9: Delete a build with confirmation
- [x] T10: Build checklist (part slots + case diagram)

**Checkpoint 3:** every user story in the SPEC works locally. Both screens are usable at 375px with no horizontal scroll.

### Phase 4: Accounts and ship
- [x] T11: Access key on the API (superseded by T12)
- [x] T12: Accounts on the API (owner, token auth, isolation)
- [x] T13: Log in and sign up screens
- [x] T14: Deploy (Neon + Render + Vercel)
- [x] T15: README with screenshot, live links, setup

**Checkpoint 4 (done):** all six SPEC success criteria pass on the live site.

### Phase 5: After v1
- [x] T16: CI on GitHub Actions (tests on every push; Render deploys only after they pass)
- [x] T17: Cooler label no longer hidden behind the CPU
- [x] T18: Skeleton loading
- [x] T19: Light / dark mode button

### Phase 6: Part bundles
- [x] T20: Bundles in the API (model, totals, validation, endpoints)
- [x] T21: Show bundles in the parts table (read-only grouping)
- [x] T22: Add, edit and delete bundles and their parts

**Checkpoint 5:** SPEC success criterion 7 passes on the live site.

### Phase 7: Maintenance
- [x] T23: End-to-end test of the main flow in CI (Playwright)

### Phase 8: Demo account
- [x] T24: Demo accounts in the API (endpoint, sample builds, 24-hour expiry, lazy cleanup)
- [x] T25: "Try the demo" and the demo banner in the UI

**Checkpoint 6 (done):** SPEC success criterion 8 passes on the live site.

### Phase 9: Price lookup ([docs/specs/price-lookup.md](../docs/specs/price-lookup.md))
- [x] T26: Shop catalogue copy (`ShopProduct`, `refresh_shop_prices`)
- [x] T27: Search API (`GET /api/prices/`)
- [x] T28: "Find prices" in the part form
- [x] T29: Daily refresh on GitHub Actions

```
T26 copy + command ─┬─ T27 search API ── T28 part form UI
                    └─ T29 daily workflow (needs T26's migration live on Neon)
```
T27 → T28 and T29 are independent, so T29 can go any time after T26 is deployed.
Render's build runs `migrate`, so merging T26 creates the table on Neon before T29 needs it.

**Checkpoint 7 (done):** price lookup spec success criteria 1–6 pass on the live site. The scheduled runs of 2026-10-29 and 2026-10-30 were green.

### Phase 10: Part search pop-up ([docs/specs/price-lookup.md, part 2](../docs/specs/price-lookup.md#part-2-part-search-pop-up))
- [x] T30: Short names in the search API (`shorten()`, `short_title`)
- [x] T31: The Part box's search pop-up

```
T30 shorten() + short_title ── T31 Part combobox
```
T31's tests use fixtures, so it can be built before T30 is deployed, but it's only useful
live once T30 is on Render. No new dependencies (the combobox is hand-written), no migration.

**Checkpoint 8:** part 2's success criteria 1–5 pass on the live site.

### Phase 11: Builds summary ([docs/specs/builds-summary.md](../docs/specs/builds-summary.md))
- [x] T32: Summary API (`GET /api/builds/summary/`) and the demo's sale dated today
- [x] T33: The summary line on the builds list

```
T32 summary API ── T33 builds list line
```
T33's tests use fixtures, so it can be built before T32 is deployed, but it's only useful
live once T32 is on Render. No migration, no new dependencies.

**Checkpoint 9 (done):** the builds summary spec's success criteria 1–4 pass on the live site.

### Phase 12: CI speedups ([docs/specs/ci-speedups.md](../docs/specs/ci-speedups.md))
- [x] T34: Cache Playwright's Chromium, cancel superseded PR runs, job time limits

**Checkpoint 10:** the CI speedups spec's success criteria 2–4 hold on the next PRs.

### Phase 13: Copy listing ([docs/specs/copy-listing.md](../docs/specs/copy-listing.md))
- [x] T35: Copy listing: the post, the dialog and the header button

One task: the post is only useful through the dialog, and the whole feature is a pure
function, one dialog and one button. Frontend only: no API, migration or dependency.

**Checkpoint 11 (done):** the copy listing spec's success criteria 1–4 pass on the live site.

### Phase 14: Public ids ([docs/specs/public-ids.md](../docs/specs/public-ids.md))
- [x] T36: The frontend takes any id, as a string
- [x] T37: Public UUIDs in the database and the API

```
T36 frontend takes any id ── (deployed) ── T37 UUIDs in the database and API
```
T36 goes first and is deployed on its own: it works with today's integer API, so when T37
lands, the frontend is already live and there's no window where the two disagree. T37 is one
task because the four models share one migration, and the children's `build`/`bundle`
fields must switch at the same time as the builds' ids. No new dependencies.

**Checkpoint 12 (done):** the public ids spec's success criteria 1–4 pass on the live site.

### Phase 15: Part condition ([docs/specs/part-condition.md](../docs/specs/part-condition.md))
- [x] T38: Set and see a part's condition (field, API, form, table)
- [x] T39: Condition in the Copy listing post, and on the demo's parts

```
T38 set and see a condition ── T39 in the post + demo
```
T38 is the whole path from the form to the table, so it's useful on its own. T39 only reads
the field. One migration (one column with a database default), no new dependencies. Either
order of deploy is safe: DRF ignores a `condition` the old API doesn't know, and the
frontend treats a missing `condition` as blank.

**Checkpoint 13 (done):** the part condition spec's success criteria 1–4 pass on the live site.

### Phase 16: Google sign-in ([docs/specs/google-sign-in.md](../docs/specs/google-sign-in.md))
- [x] T40: Sign in with Google (new and returning users)
- [x] T41: The Account page: connect and disconnect Google
- [x] T42: Privacy page, and publishing the Google app

```
(author) Google Cloud client ─┐
T40 sign in with Google ──────┴── T41 Account page: connect / disconnect
T42 privacy page ──── (author) publish the Google app
```
T40 is the whole path from Google's button to a logged-in builds list, and it brings the
`GoogleAccount` table. T41 adds the second way into that table (linking an existing account)
and the page around it. Each task ships on its own. Without a client id set, neither shows a
Google button and the API says "isn't set up", so merging before Render and Vercel have the
id is safe. The only new dependency is `google-auth` (with `requests`), added in T40 once
approved. T42 (added 2026-11-08) is a static page Google needs before the app can leave
Testing; it doesn't depend on T41, but both come before Checkpoint 14.

**Before T40's manual check:** the author creates the Google Cloud consent screen and the
OAuth client (the spec's "Setup outside the code"), and puts the client id in both `.env`
files.

**Checkpoint 14 (done):** the Google sign-in spec's success criteria 1–5 pass on the live site, with
the client id set on Render and Vercel (Vercel builds it in, so it needs a redeploy after
setting it).

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Decimal rounding drifts from the hand calculation | High (it's the core feature) | All math in Decimal, percentages quantized once, edge-case tests in T2 |
| `Authorization` blocked by CORS in production | High (nothing works on the live site) | It's in django-cors-headers' default allowed headers. T14 verifies sign-up and a write from the Vercel domain |
| One user reads or changes another's data | High | Every queryset filters by owner; T12 tests each endpoint as a second user |
| Deep link `/builds/3` returns 404 on Vercel | Med | T14 adds a `vercel.json` SPA rewrite |
| Render's free tier sleeps, so the first load takes ~30–60 s | Med (bad first impression) | Accept it for v1. Show a clear loading state, and mention it in the README |
| Totals cause one query per build on the list (N+1) | Low at this scale | `prefetch_related` in T3. A test asserts the query count is constant |
| Scope creep from the spec's extra UI (diagram, dialogs) | Med | The diagram is isolated in T10, last in Phase 3, and can slip without blocking deploy |
| A shop blocks us, changes its JSON, or its robots.txt (price lookup) | Med | A failed refresh keeps the old copy and turns the run red (T26). We stop and talk, never work around a block |
| A half-downloaded catalogue wipes a shop's prices | Med | Rows are replaced in one transaction only after every page downloaded; zero products counts as a failure (T26 tests) |
| GitHub turns off the schedule after 60 days without activity | Low | The results show "Prices from <date>"; README says how to re-enable it (T29) |
| The Neon URL leaks from the workflow | High | Only as a repository secret; the workflow never prints it (T29) |
| "rtx 3060" also matches "3060 Ti" | Low | Results show the full product name and stock; the user picks (T28) |
| A short name drops something that matters (colour, "OC") | Low | The pop-up shows the full shop name under it, and the name stays editable (T31); each bad case becomes a `shorten()` test (T30) |
| The pop-up breaks fast entry (Enter picks instead of saving) | High | Enter picks only an active row; a browser e2e test proves Enter with no active row saves (T31) |
| A request on every typing pause loads Render and Neon | Low | 300 ms pause, 2+ characters, results capped at 20, and the search reads only our ~10k-row table |
| "This month" uses the server's or browser's month instead of Manila's | Med (wrong numbers near midnight on the 1st) | `timezone.localdate()` (`TIME_ZONE = Asia/Manila`); a test with the date mocked on both sides of the boundary (T32) |
| The summary disagrees with the list (bundles, extra costs) | High (the feature is trust in the numbers) | It sums the model's own `profit` and `total_cost`, never a second formula; a test with a bundle and extra costs (T32) |
| A demo opened on the 1st–3rd shows ₱0 this month | Low | The demo's sale is dated today (T32) |
| The post leaks what was paid, a shop or a note | High (a buyer sees the margin) | `listingText` reads only names, categories and the selling price; a test fills in every other field and checks none appear (T35) |
| Copying fails on a phone or an insecure page | Med | The text is selected and the dialog says to press Ctrl+C or use Copy; a test covers the failed path, and a manual paste on a phone (T35) |
| The migration fails or locks the live database | High (the app is down until it's fixed) | One `ADD COLUMN` per table with a database default, on a few hundred rows; run on a copy of the schema in CI first; the migration is reversible (T37) |
| Old code inserts during the deploy and fails on the new column | Med | The column's database default (`gen_random_uuid()`) fills it; a test inserts without it (T37) |
| An integer id slips through somewhere (a nested field, a docs example) | Med (the point of the change) | A test walks every response of all four resources and fails on any integer `id`, `build` or `bundle` (T37) |
| New frontend and old API (or the reverse) disagree mid-deploy | Med | T36 ships first and works with integer ids; it never checks an id's format (T36) |
| Old code inserts during the deploy and fails on `condition` | Med | The column has a database default (`''`); a test inserts without it (T38) |
| The condition label crowds a long name on a phone | Low | It wraps with the name, no new column; checked at 375px (T38) |
| Condition changes the post for builds that have none | Med (posts people already copy) | A test: a build without conditions gives exactly today's post (T39) |
| A forged or someone else's ID token signs someone in | High | Every token goes through `google-auth`'s verification with our client id as the audience; one test runs that real verification on a token signed by a test key, the rest mock it (T40) |
| Tests mock Google, so the real flow breaks only live (CSP, referrer, origins) | Med | The manual check on localhost with a real client id before the PR, and Checkpoint 14 on the live site (T40, T41) |
| A Google sign-in takes over the wrong account | High | Users are found by `sub` only, never by email; connecting needs the user's own token (T40, T41) |
| Someone locks themselves out by disconnecting Google | Med | Disconnect is refused without a usable password (T41) |
| Demo cleanup deletes a Google-only account (no password, like a demo) | High | Google usernames never start with `demo-`; a test with an old Google-only account (T40) |
| Two Google sign-ins pick the same new username at once | Low | Catch the unique-name error and try the next number, as sign-up already does (T40) |

## Open Questions

1. **Production server (T14):** `gunicorn`, explained to the author on 2026-10-26. Confirm it before adding it in T14.

Resolved: React Router (yes).
