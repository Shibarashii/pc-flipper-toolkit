# Tasks: PC Flipper Toolkit v1

Plan: [plan.md](plan.md) · Spec: [SPEC.md](../SPEC.md) · Design: [docs/brand-guidelines.md](../docs/brand-guidelines.md)

**Standard verification** (every task, before committing):
- Backend: `cd backend && .venv/bin/python manage.py test && .venv/bin/ruff check . && .venv/bin/ruff format --check .`
- Frontend: `cd frontend && npm test && npm run lint && npm run build`

Each task gets its own branch, `feat/<n>-<slug>`, which is fast-forwarded into `main` once verification passes.

---

## Phase 1: Foundation

### - [x] T1: Create a build from the list and land on its detail page

**Description:** Install `react-router` and set up `<BrowserRouter>` with two routes (`/` and `/builds/:id`).
"New build" on the list opens a dialog that asks only for a name, POSTs it, and navigates to
`/builds/:id`. For now the detail page is a stub: it shows `Build 01` and the build's name,
and has loading and error states.

**Acceptance criteria:**
- [x] "New build" opens a dialog. Submitting with an empty name is blocked. Submitting a name creates the build and goes to `/builds/<id>`.
- [x] Clicking a build row (desktop) or card (mobile) goes to its detail page. Browser back returns to the list.
- [x] Reloading `/builds/<id>` in dev loads that build. An unknown id shows a "Build not found" state.

**Verification:**
- [x] Standard verification passes
- [x] Manual (author, in a browser): create 2 builds, click between list and detail, use back/forward, reload on a detail URL

**Dependencies:** None
**Files:** `frontend/package.json`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/api.ts`, `frontend/src/pages/BuildsList.tsx`, `frontend/src/pages/BuildDetail.tsx`, `frontend/src/components/NewBuildDialog.tsx`
**Scope:** M

### - [x] T2: Part and ExtraCost models with build totals

**Description:** Add the `Part` and `ExtraCost` models from the SPEC (FK to Build, cascade on
delete, prices ≥ 0) and a migration. Add totals properties on `Build`: listed_total,
parts_cost, extra_costs_total, total_cost, profit, profit_margin, below_market,
below_market_pct and voucher_savings. Everything uses Decimal, with percentages rounded to 2 places.

**Acceptance criteria:**
- [x] The migration applies cleanly on the local Postgres. Deleting a build deletes its parts and extra costs.
- [x] Every total matches the SPEC's example JSON for that example's inputs.
- [x] Edge cases are tested: no parts, no selling price (the four selling-price fields are `None`), a selling price of 0 (profit margin is `None`, profit is negative), no listed prices (below-market % is `None`), a loss, and rounding (e.g. 1/3 → `33.33`).

**Verification:**
- [x] Standard verification (backend) passes
- [x] `python manage.py makemigrations --check` reports no changes

**Dependencies:** None
**Files:** `backend/builds/models.py`, `backend/builds/migrations/0002_*.py`, `backend/builds/tests.py`
**Scope:** S

### - [x] T3: Build detail API with nested parts, extra costs and totals

**Description:** `GET /api/builds/{id}/` returns the build with nested `parts`, `extra_costs`
and a read-only `totals` object (money as strings). The list returns `totals` without nesting.
Add `ModelViewSet`s at `/api/parts/` and `/api/extra-costs/` (POST, PATCH and DELETE; the
build id goes in the body). Use `prefetch_related` to avoid N+1 queries.

**Acceptance criteria:**
- [x] Detail and list responses match the SPEC's API section, including `null` for the selling-price-dependent fields.
- [x] Create, update and delete work for parts and extra costs, and a negative price returns 400 with the field name.
- [x] The list (N builds) and the detail endpoint each take a constant number of queries (`assertNumQueries`). The prefetch lives on the viewset `queryset`, so both endpoints get it.

**Verification:**
- [x] Standard verification (backend) passes
- [x] Manual: `curl localhost:8000/api/builds/<id>/` after adding a part with `curl -X POST`

**Dependencies:** T2
**Files:** `backend/builds/serializers.py`, `backend/builds/views.py`, `backend/config/urls.py`, `backend/builds/tests.py`
**Scope:** M

### Checkpoint 1
- [x] All backend and frontend tests pass, and lint and build are clean
- [x] A build can be created in the UI, and its detail URL works
- [x] `/api/builds/<id>/` shows `parts`, `extra_costs` and `totals`
- [x] Review with the human before Phase 2

---

## Phase 2: Core flow

### - [x] T4: Detail page shows parts and the summary, and can add a part

**Description:** Replace the stub with the real detail page layout (brand guidelines and
Figma). It has the Summary panel with every total, a parts table (desktop) or stacked cards
(mobile), and an add-part row (name, category, shop, listed price, bought for). After
saving, the page refetches the build so the totals update from the server.

**Acceptance criteria:**
- [x] Summary shows all 8 totals from user story 5. `null` shows as "—", and a negative profit is red with a true minus sign.
- [x] A negative `below_market` (selling above market) reads as "₱X above market", not "−₱X below market".
- [x] Adding a part updates the table and the totals without a page reload. A server validation error (e.g. a negative price) is shown on that field.
- [x] The empty state ("no parts yet") and the loading and error states render.

**Verification:**
- [x] Standard verification passes, including a Vitest test that `Summary` renders the given totals and `null` → "—"
- [x] Manual (headless screenshots vs. Figma, desktop + 375px, incl. add-part error state)
- [x] Manual (author, in a browser): add 3 real parts and check the totals by hand

**Dependencies:** T1, T3
**Files:** `frontend/src/api.ts`, `frontend/src/pages/BuildDetail.tsx`, `frontend/src/components/PartsTable.tsx`, `frontend/src/components/Summary.tsx`, `frontend/src/components/Summary.test.tsx`
**Scope:** M

### - [x] T5: Edit and delete parts inline

**Description:** The pencil turns a part row into inputs with Save/Cancel. Enter saves and
Esc cancels. The row also gets a delete action. It's the same input row component as the add row.

**Acceptance criteria:**
- [x] Editing any field and pressing Enter saves it (PATCH) and the totals update. Esc restores the original values.
- [x] Delete removes the part and the totals update.
- [x] Only one row is in edit mode at a time.

**Verification:**
- [x] Standard verification passes
- [x] Manual: edit and delete parts by keyboard and by mouse, on desktop and mobile

**Dependencies:** T4
**Files:** `frontend/src/components/PartsTable.tsx`, `frontend/src/api.ts`
**Scope:** S

### - [x] T6: Extra costs: add, edit, delete

**Description:** An extra costs list under the parts, with label and amount. It uses the
same inline add/edit/delete pattern as parts.

**Acceptance criteria:**
- [x] Adding, editing and deleting an extra cost updates "Extra costs" and "Total cost" in the summary.
- [x] A negative amount shows a field error. The empty state renders.

**Verification:**
- [x] Standard verification passes
- [x] Manual: add shipping plus a platform fee, and check that total cost = parts cost + extras

**Dependencies:** T4
**Files:** `frontend/src/components/ExtraCosts.tsx`, `frontend/src/pages/BuildDetail.tsx`, `frontend/src/api.ts`
**Scope:** S

### - [x] T7: Header: status, selling price, sold date, name, notes

**Description:** The build header lets you edit the name, set the status, and enter a selling
price. The sold date shows only when the status is Sold: switching to Sold fills in today's
date (editable), and switching away clears it. The notes textarea under Extra costs saves on blur.

**Acceptance criteria:**
- [x] Setting a selling price fills in profit, margin and below market. Clearing it shows "—" again.
- [x] The sold date behaves as described above and is saved to the server.
- [x] Notes persist after a reload.

**Verification:**
- [x] Standard verification passes
- [x] Manual: take a build through planning → sold and back, and reload after each step

**Dependencies:** T4
**Files:** `frontend/src/pages/BuildDetail.tsx`, `frontend/src/components/BuildHeader.tsx`, `frontend/src/api.ts`
**Scope:** S

### Checkpoint 2
- [x] One real flip entered (≥ 6 parts, ≥ 2 extra costs), and its profit matches the hand calculation to the centavo
- [x] All tests pass
- [x] Review the UI with the human before Phase 3

---

## Phase 3: Complete v1 locally

### - [x] T8: Builds list shows total cost and profit

**Description:** Add "Total cost" and "Profit" (signed, green/red) to the desktop table and the mobile cards, using the list's `totals`.

**Acceptance criteria:**
- [x] Each row shows total cost, selling price and profit, and a build with no selling price shows "—" for profit.
- [x] The mobile cards show the same values without horizontal scroll at 375px.

**Verification:**
- [x] Standard verification passes
- [x] Manual: compare the list values with each build's detail summary

**Dependencies:** T3
**Files:** `frontend/src/pages/BuildsList.tsx`, `frontend/src/api.ts`
**Scope:** S

### - [x] T9: Delete a build with confirmation

**Description:** A "Delete build" action on the detail page opens a dialog that names how many
parts and extra costs will be deleted with it. Confirming deletes the build and returns to the list.

**Acceptance criteria:**
- [x] The dialog text includes the correct counts (e.g. "7 parts and 2 extra costs").
- [x] Cancel does nothing. Confirm deletes the build and navigates to `/`, and the build is gone from the list.

**Verification:**
- [x] Standard verification passes
- [x] Manual: delete a build that has parts, then check `curl /api/parts/` no longer shows them

**Dependencies:** T4
**Files:** `frontend/src/pages/BuildDetail.tsx`, `frontend/src/components/ConfirmDialog.tsx`, `frontend/src/api.ts`
**Scope:** S

### - [x] T10: Build checklist (part slots + case diagram)

**Description:** The Build section above Parts shows a case diagram and a checklist of the 8
slots, computed in the frontend from the parts list. Six slots are required (CPU, Motherboard,
RAM, Storage, PSU, Case); Cooler and GPU are optional. It shows "N of 6 required parts" with a
progress bar. An "Add" link opens the add-part row with that category preselected.

**Acceptance criteria:**
- [x] A slot is filled when there's ≥ 1 part in its category. `other` parts don't appear. Optional slots never count as missing.
- [x] The count and progress bar are correct for 0, some, and all 6 required parts.
- [x] "Add" on a slot opens the add row with the category preselected.

**Verification:**
- [x] Standard verification passes, including a Vitest test of the slot computation (pure function)
- [x] Manual: compare with the Figma frame at desktop and mobile widths

**Dependencies:** T4
**Files:** `frontend/src/components/BuildChecklist.tsx`, `frontend/src/slots.ts`, `frontend/src/slots.test.ts`, `frontend/src/pages/BuildDetail.tsx`
**Scope:** M

### Checkpoint 3
- [x] Every user story in the SPEC works locally
- [x] Both screens are usable at 375px with no horizontal scroll, in light and dark mode
- [x] Review with the human before Phase 4

---

## Phase 4: Accounts and ship

### - [x] T11: Access key on the API

> **Superseded by T12 (multi-user accounts).** The access key is removed there; the
> no-moving-parts/costs check stays.

**Description:** A DRF permission class lets GET/HEAD/OPTIONS through, and requires the
`X-Access-Key` header to equal `settings.ACCESS_KEY` for writes (compared with
`secrets.compare_digest`). If `ACCESS_KEY` is unset, every write is refused. The header is
added to `CORS_ALLOW_HEADERS`.

**Acceptance criteria:**
- [x] A write without the key or with the wrong key returns 403. With the right key, it succeeds. Reads never need a key.
- [x] An empty or unset `ACCESS_KEY` refuses all writes, so there's no "open by accident" state.
- [x] A CORS preflight allows `X-Access-Key`.
- [x] A part or extra cost can't be moved to another build: `build` is ignored or rejected on PATCH (checkpoint 1 review, #2).

**Verification:**
- [x] Standard verification (backend) passes. Existing write tests send the key.

**Dependencies:** T3
**Files:** `backend/builds/permissions.py`, `backend/config/settings.py`, `backend/builds/tests.py`
**Scope:** S

### - [x] T12: Accounts on the API (owner, token auth, isolation)

**Description:** `Build.owner` (FK to Django's `User`, cascade). A migration adds it and gives
existing builds to the first superuser. DRF token auth (`rest_framework.authtoken`, already
installed with DRF, no new dependency) replaces the access key: `POST /api/auth/signup/`,
`/login/`, `/logout/` and `GET /api/auth/me/`. Every other endpoint needs a token. Querysets
are filtered to the user's own builds (parts and costs through their build), and the `build`
field only accepts the user's own builds. Sign-up and log-in are throttled per IP. The access
key permission, `ACCESS_KEY` and the `X-Access-Key` CORS header are removed.

**Acceptance criteria:**
- [x] Sign up returns a token. Log in with the right password returns one; a wrong one is 400. Log out deletes the token, so it then gets 401.
- [x] Without a token, every builds/parts/extra-costs endpoint returns 401.
- [x] User B gets 404 for user A's build, part and extra cost (read, PATCH, DELETE), sees none of them in lists, and gets 400 adding a part or cost to A's build.
- [x] New builds belong to whoever created them. Existing builds now belong to the superuser.
- [x] Too many log-in attempts return 429. Password validator messages come back under `password`.
- [x] The auth endpoints are documented in `/api/docs/` (schema test passes).

**Verification:**
- [x] Standard verification (backend) passes
- [x] Manual: `curl` sign up two users and check each sees only their own builds

**Dependencies:** T11
**Files:** `backend/builds/models.py` + migration, `backend/builds/views.py`, `backend/builds/serializers.py`, `backend/builds/auth.py` (new), `backend/config/settings.py`, `backend/config/urls.py`, `backend/builds/tests.py`; delete `backend/builds/permissions.py`
**Scope:** M

### - [x] T13: Log in and sign up screens

**Description:** `/login` and `/signup` pages (username, password; linking to each other).
Logged out, every other route redirects to `/login`. The token is kept in `localStorage`
(wrapped in try/catch) and sent as `Authorization: Token …`. A 401 logs out and returns to
`/login` with "Your session ended. Log in again." The header shows the username and "Log out".
There are no Figma frames for these, so they follow the brand guidelines and the existing
dialogs' form style. Replaces the read-only mode / "Unlock editing" work (the unmerged
`feat/12-read-only-mode` branch); its `request()` header merging is kept.

**Acceptance criteria:**
- [x] Logged out, `/` and `/builds/:id` redirect to `/login`. After logging in, the builds list shows only that user's builds.
- [x] Sign-up and log-in errors show under the right field (wrong password, username taken, weak password); a 429 shows "Too many attempts. Wait a minute and try again."
- [x] `request()` in `api.ts` merges headers (`Content-Type` plus `Authorization`) instead of replacing them (checkpoint 1 review, #3).
- [x] Logging in persists after a reload. Log out returns to `/login`. A 401 mid-session logs out with the message.

**Verification:**
- [x] Standard verification passes
- [x] Manual: two accounts in two browsers (normal + private window) never see each other's builds; check at 375px

**Dependencies:** T12
**Files:** `frontend/src/api.ts`, `frontend/src/auth.ts`, `frontend/src/App.tsx`, `frontend/src/pages/Login.tsx` (log in + sign up), tests
**Scope:** M

### - [x] T14: Deploy (Neon + Render + Vercel)

**Description:** Postgres on Neon, Django on Render (migrations in the build step, `DEBUG`
off, new production `SECRET_KEY`), React on Vercel with `VITE_API_URL` and
a SPA rewrite in `vercel.json`. The admin needs its CSS/JS served in production (`collectstatic`
plus WhiteNoise, a new dependency to ask about), a production superuser, and
`SECURE_PROXY_SSL_HEADER` so the admin login's CSRF check accepts Render's HTTPS proxy. Set `NUM_PROXIES` from the `X-Forwarded-For` Render actually sends, so the log-in rate limit counts real client IPs. You'll need to create the accounts yourself, and I'll walk
through each dashboard step with you.

**Acceptance criteria:**
- [x] The live frontend loads builds from the live API, and a deep link to `/builds/<id>` works on refresh.
- [x] A request without a token returns 401 on the live API. Signing up and adding a build from the Vercel site works (CORS ok).
- [x] Data survives a Render redeploy.

**Verification:**
- [x] `curl <api>/api/builds/` → 401. With a token from `curl -X POST <api>/api/auth/login/` → 200
- [x] Manual: phone plus desktop on the live URLs

**Dependencies:** T13
**Files:** `backend/requirements.txt` (WSGI server, asks first), `backend/config/settings.py`, `frontend/vercel.json`, `render.yaml` (optional)
**Scope:** M

### - [x] T15: README with screenshot, live links, setup

**Acceptance criteria:**
- [x] The README has a one-paragraph pitch, a screenshot, the live app and API links, the stack, and setup steps.
- [x] The setup steps work on a fresh clone into a temp directory (backend tests and the frontend build pass).
- [x] It mentions the Render cold start.

**Verification:**
- [x] Manual: follow the README from a fresh `git clone` in a scratch directory

**Dependencies:** T14
**Files:** `README.md`, `img/*.png`
**Scope:** S

### Checkpoint 4: Done
- [x] All six SPEC success criteria pass on the live site
- [x] All tests pass on `main`

---

## Phase 5: After v1

### - [x] T16: CI on GitHub Actions

**Description:** One workflow, `.github/workflows/ci.yml`, on every push and pull request.
Backend job: Python 3.14 with a PostgreSQL service, `ruff check`, `ruff format --check`,
`manage.py test`. Frontend job: Node 24, `npm ci`, `tsc -b` (in the build), lint, tests, build.
No new dependencies. Render's auto-deploy is then set to wait for the checks.

**Acceptance criteria:**
- [x] Pushing to `main` shows a CI check next to Vercel's on GitHub, and it passes.
- [x] A failing test turns the check red (tried on a throwaway branch).
- [x] Render's Auto-Deploy is set to "After CI Checks Pass". The README has a CI badge.

**Verification:**
- [x] The workflow's commands pass locally first
- [x] Manual: the green run on GitHub, and the red run on the throwaway branch

**Dependencies:** T15
**Files:** `.github/workflows/ci.yml`, `README.md`
**Scope:** S
