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
- [ ] T16: CI on GitHub Actions (tests on every push; Render deploys only after they pass)

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

## Open Questions

1. **Production server (T14):** `gunicorn`, explained to the author on 2026-10-26. Confirm it before adding it in T14.

Resolved: React Router (yes).
