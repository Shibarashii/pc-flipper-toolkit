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

**Checkpoint 7:** price lookup spec success criteria 1–6 pass on the live site. All but criterion 5 ("runs green daily") pass as of 2026-10-29; it waits on the first scheduled run (18:00 UTC).

### Phase 10: Part search pop-up ([docs/specs/price-lookup.md, part 2](../docs/specs/price-lookup.md#part-2-part-search-pop-up))
- [x] T30: Short names in the search API (`shorten()`, `short_title`)
- [x] T31: The Part box's search pop-up

```
T30 shorten() + short_title ── T31 Part combobox
```
T31's tests use fixtures, so it can be built before T30 is deployed, but it's only useful
live once T30 is on Render. No new dependencies (the combobox is hand-written), no migration.

**Checkpoint 8:** part 2's success criteria 1–5 pass on the live site.

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

## Open Questions

1. **Production server (T14):** `gunicorn`, explained to the author on 2026-10-26. Confirm it before adding it in T14.

Resolved: React Router (yes).
