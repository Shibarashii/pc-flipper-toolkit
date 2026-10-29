# Spec: PC Flipper Toolkit (v1: Build Profit Tracker)

Source of intent: [docs/intent/pc-flipper-toolkit.md](docs/intent/pc-flipper-toolkit.md)

## Objective

A web app for people who buy PC parts, assemble them, and sell the whole PC. Each person
signs up for their own account and sees only their own builds. Each flip is a **build**. For every build the app shows what the parts are worth on the
market, what they actually cost, the true profit after extra costs, and how far below
market the PC is priced. It replaces the author's spreadsheet.

### User stories

0. I can sign up with a username and password, log in, and log out. I only ever see my own builds.
1. I can create a build with a name and see it in a list of all my builds.
2. I can add parts to a build: name, category, shop, **listed price** (market price, e.g. Shopee) and **bought for** (what I actually paid).
3. I can add extra costs to a build: a label and an amount (shipping, platform fee, thermal paste, cables).
4. I can set a selling price and a status (planning → building → listed → sold).
5. On a build, I see these totals:
   - **Listed total:** sum of the parts' listed prices
   - **Parts cost:** sum of the bought-for prices of parts not in a bundle, plus each bundle's price
   - **Extra costs:** sum of the extra costs
   - **Total cost:** parts cost + extra costs
   - **Profit:** selling price − total cost (blank if there's no selling price yet)
   - **Profit margin:** profit ÷ selling price, as a %
   - **Below market:** listed total − selling price, in ₱ and as % of the listed total
   - **Voucher savings:** listed total − parts cost
6. On the builds list, I see each build's status, total cost, selling price and profit.
7. I can edit and delete builds, parts and extra costs.
8. Everything works on a phone-sized screen.
9. I can add a **bundle**: parts bought together for one price (e.g. motherboard + CPU + RAM
   for ₱7,500). Each part in it has its own name, category and listed price, but its
   bought-for is optional, typed in only if I know it. The bundle's price counts once in the
   totals. ([docs/ideas/part-bundles.md](docs/ideas/part-bundles.md))
10. Without signing up, I can **try a demo**: one click logs me into my own throwaway account
    with two sample builds, which I can change freely. Nobody else sees my changes, and the
    account is deleted after 24 hours. ([docs/intent/demo-account.md](docs/intent/demo-account.md))

### Out of scope (v1)
Price scraping (a price lookup from PC shops came later: [docs/specs/price-lookup.md](docs/specs/price-lookup.md)), voucher detection, buyer-only build mode, part compatibility checks,
multiple currencies (amounts are in PHP ₱ only). For accounts: email, password reset,
sharing a build with another user, turning a demo account into a real one, and social login.

## Tech Stack

| Layer | Choice |
|---|---|
| Backend | Python 3.14, Django 6.0, Django REST Framework, django-cors-headers, psycopg 3, dj-database-url, python-dotenv, drf-spectacular (OpenAPI docs); in production, gunicorn (web server) and WhiteNoise (static files) |
| Database | PostgreSQL everywhere: local install (dev), Neon free tier (prod). Configured via `DATABASE_URL` |
| Frontend | React 19 + TypeScript, Vite, Tailwind CSS v4, React Router v8 |
| Backend tests | Django test runner (`manage.py test`) |
| Frontend tests | Vitest + React Testing Library |
| End-to-end tests | Playwright (Chromium), desktop and 375px, a required CI check |
| Lint/format | Ruff (Python), ESLint + Prettier (TS) |
| Deploy | Vercel (frontend), Render (backend) |

Exact versions get pinned in `requirements.txt` / `package.json` when the project is scaffolded.

## Data Model

```
Build
  owner           User (Django's built-in user), deleted with it
  name            text
  status          planning | building | listed | sold   (default planning)
  selling_price   decimal(10,2), nullable
  sold_at         date, nullable; set only when status is sold
  notes           text, blank
  created_at      datetime

Part             (belongs to Build, deleted with it)
  name            text            e.g. "Ryzen 5 7600"
  category        cpu | gpu | motherboard | ram | storage | psu | case | cooler | other
  shop            text, blank     e.g. "Shopee - DynaQuest"
  listed_price    decimal(10,2)   market price
  bought_for      decimal(10,2)   actual price paid; nullable only when the part is in a bundle
  bundle          Bundle, nullable   deleted with it; same build as the part

Bundle           (belongs to Build, deleted with it)
  name            text            e.g. "B550m + R5 5600 + 16GB"
  shop            text, blank
  bought_for      decimal(10,2)   the one price paid for everything in it

ExtraCost        (belongs to Build, deleted with it)
  label           text            e.g. "Shipping"
  amount          decimal(10,2)
```

Existing builds (made before accounts) are given to the first superuser by the migration.

Money is always `Decimal` in Python and serialized as a string in JSON (`"12500.00"`).
It is never a float. All prices must be ≥ 0.

**Bundles:** a bundled part's bought-for is a breakdown of the bundle's price, typed in by
hand or left blank. It never counts in the totals on its own (the bundle's price does), and the
bundled parts' bought-for amounts can't add up to more than the bundle's price. A loose part
(not in a bundle) always has a bought-for. An empty bundle is allowed; its price still counts.

**Demo accounts:** an ordinary Django user, so no new table or migration. Its username is
`demo-` plus random letters and it has no usable password, so it can only be used through
the token it was made with. Sign-up refuses usernames starting with `demo-`. Cleanup deletes
users matching both (the prefix and no usable password), so a real account can never be
caught.

## API

All endpoints are under `/api/`. JSON in, JSON out. Only `PATCH` is supported for updates (no `PUT`).

**Reference docs:** an OpenAPI 3 schema is generated from the code with drf-spectacular. Interactive docs (Swagger UI) are at `/api/docs/` and the raw schema at `/api/schema/`. This table is the overview, and `/api/docs/` is the source of truth for fields and examples.

**Admin:** the Django admin at `/admin/` can browse and fix builds, parts, bundles and extra costs directly. Logging in needs a superuser (`python manage.py createsuperuser`), and is rate-limited per IP like the API's log-in. The admin shows every user's builds.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/signup/` | Create an account (`username`, `password`) → `{token, username}` |
| POST | `/api/auth/login/` | Log in → `{token, username}` |
| POST | `/api/auth/logout/` | Delete the current token |
| POST | `/api/auth/demo/` | Create a demo account with the sample builds → `{token, username}` (201) |
| GET | `/api/auth/me/` | The logged-in user (`{username}`) |
| GET, POST | `/api/builds/` | List builds (with totals) / create a build |
| GET, PATCH, DELETE | `/api/builds/{id}/` | Build detail, including `parts`, `bundles`, `extra_costs` and `totals` |
| POST | `/api/parts/` | Add a part (`build` id in the body) |
| PATCH, DELETE | `/api/parts/{id}/` | Edit / remove a part |
| POST | `/api/bundles/` | Add a bundle (`build` id in the body) |
| PATCH, DELETE | `/api/bundles/{id}/` | Edit / remove a bundle (removing it removes its parts) |
| POST | `/api/extra-costs/` | Add an extra cost (`build` id in the body) |
| PATCH, DELETE | `/api/extra-costs/{id}/` | Edit / remove an extra cost |
| GET | `/api/prices/?q=` | Search the PC shops' prices ([price lookup spec](docs/specs/price-lookup.md)) |

`totals` is computed on the server and read-only:
```json
{
  "listed_total": "52000.00", "parts_cost": "45500.00", "extra_costs": "800.00",
  "total_cost": "46300.00", "profit": "3700.00", "profit_margin": "7.40",
  "below_market": "2000.00", "below_market_pct": "3.85", "voucher_savings": "6500.00"
}
```
`profit`, `profit_margin`, `below_market` and `below_market_pct` are `null` when there's no
selling price yet. The percentage fields are also `null` when they would divide by zero.

Each part has a `bundle` id (or `null`). Each bundle in `bundles` also has read-only
`listed_total` (its parts' listed prices) and `unassigned` (its price minus its parts' typed
bought-for amounts). Errors (400, under the field): a loose part without `bought_for`; bundled
amounts adding up to more than the bundle's price (under the part's `bought_for`, or the
bundle's `bought_for` when lowering it); a `bundle` from another build.

**Accounts and auth:** every endpoint except sign-up and log-in needs
`Authorization: Token <token>` (DRF's built-in token auth); without it the API returns 401.
Token auth rather than session cookies because the frontend (Vercel) and API (Render) are on
different sites, where browsers block or restrict cookies. Signing up or logging in returns
the token; the frontend keeps it in `localStorage`. Logging out deletes it on the server.
A token works for 30 days from when it was made, then returns 401; logging in again gives a
new one.
Passwords go through Django's password validators. Sign-up, log-in and demo creation share one
rate limit per IP.

**Demo accounts** work for 24 hours from when they were made, then their token returns 401 like
an expired one. Render's cron jobs aren't free (at least $1 a month), so cleanup is lazy: creating a demo
first deletes demo accounts older than 24 hours (and their builds, by cascade).

Every user sees and changes only their own data: builds are filtered by `owner`, and parts
bundles and extra costs by their build's owner. Another user's build, part, bundle or cost
returns 404 (not 403, so ids don't reveal what exists), and none of them can be added to
another user's build (400). A part, bundle or cost can't be moved to another build.

## Screens

0. **Log in** (`/login`) and **Sign up** (`/signup`): username and password, linking to each other. Logged out, every other page redirects here; logging in goes to the builds list.
   - The header shows the username and "Log out" when logged in.
   - Both pages have a **"Try the demo"** button that creates a demo account and goes to the
     builds list. A demo account sees a banner under the header: it's a demo, deleted after 24
     hours, ending in a "Sign up for your own account" link that ends the demo and opens sign-up
     (a link, so it doesn't stack under the header's button). For a demo, the header's "Log out"
     reads "Exit demo".
   - **Sample builds:** a sold flip (every required slot filled, a bundle, two extra costs, a
     profit) and an in-progress build (some required slots empty, no selling price yet).
1. **Builds list** (`/`): one card or row per build showing name, status badge, total cost, selling price and profit (green if positive, red if negative). Has a "New build" button.
   - "New build" opens a dialog that asks only for the name. Creating it goes straight to the new build's detail page.
2. **Build detail** (`/builds/:id`):
   - Header: name, status selector, selling price input.
   - Sold date: shown only when status is Sold. Switching to Sold fills in today's date (editable). Switching away from Sold clears it.
   - Build section (above Parts): a case diagram plus a checklist showing which part slots are filled.
     - Slots: CPU, Motherboard, Cooler, RAM, Storage, GPU, PSU, Case, one per `Part.category`. A slot is filled when the build has at least one part in that category. Parts in `other` aren't shown in the diagram.
     - Required slots are CPU, Motherboard, RAM, Storage, PSU and Case. Cooler and GPU are optional (stock coolers, APU builds) and never count as missing.
     - Shows "N of 6 required parts" with a progress bar. A missing or optional slot has an "Add" link that opens the add-part row with that category preselected.
     - Computed in the frontend from the parts list. No data-model or API change.
   - Summary panel with all the totals from user story 5.
   - Parts table: add, edit and delete rows inline. The pencil turns a row into inputs with Save/Cancel (Enter saves, Esc cancels). The add row looks the same. On mobile it becomes stacked cards.
   - Bundles, inside the parts table: a bundle row (name, shop, listed total, its one bought-for
     price) with its parts indented under it. A bundled part's bought-for shows the typed amount
     or "—". When typed amounts don't cover the price, the bundle shows "₱X not assigned".
     - "Add bundle" next to "Add part" adds a bundle row (name, shop, price), same inline
       pattern. A bundle row has "Add part" (adds a part inside it), edit and delete.
     - The part form has a "Bundle" select (none, or one of the build's bundles); bought-for is
       optional only when a bundle is picked. On mobile the bundle is a card with its parts
       under it.
     - Deleting a bundle asks first, naming the parts that go with it.
   - Extra costs list: add, edit and delete, same inline pattern as parts.
   - Notes: a plain textarea under Extra costs that saves on blur.
   - Delete build: a confirmation dialog naming how many parts, bundles and extra costs will be deleted with it.

States each screen must handle:
- **Builds list:** no builds yet (message plus "New build").
- **Build detail:** no parts or extra costs yet, an empty bundle, a bundle with prices not fully assigned, no selling price (profit and margin show "—"), a loss (red), and a validation error on a field (e.g. negative price).
- **Both:** loading and request failed. A 401 (token deleted or expired) logs out and goes to `/login` with "Your session ended. Log in again." (for a demo: "Your demo ended. Try it again or sign up.", since it has no password)
- **Log in / sign up:** wrong username or password, username taken, password rejected by the validators (their messages, under the field), and too many attempts (429).

Visual design (colors, type, components, light/dark) follows [docs/brand-guidelines.md](docs/brand-guidelines.md).
Builds are labeled `Build 01` in the UI: the build's `number` (1, 2, 3… among the user's own
builds, oldest first, zero-padded to 2 digits), never the database id, which counts every
user's builds. It's a count, so deleting a build renumbers the later ones.

Money is shown as `₱12,500.00` using `Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })`.

## Commands

Backend (from `backend/`, fish shell):
```
python -m venv .venv && source .venv/bin/activate.fish
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env               # one-time; edit values as needed
createdb pc_flipper_toolkit         # one-time; needs CREATEDB (tests create test_pc_flipper_toolkit)
python manage.py migrate
python manage.py createsuperuser    # one-time; for the admin at /admin/
python manage.py runserver          # http://localhost:8000 · API docs at /api/docs/
python manage.py test               # run backend tests
ruff check . && ruff format .       # lint + format
```

Frontend (from `frontend/`):
```
npm install
cp .env.example .env               # one-time; set VITE_API_URL in production
npm run dev                         # http://localhost:5173, proxies /api → :8000
                                    # phone on the same Wi-Fi: use the "Network" URL it prints
npm test                            # vitest run
npm run lint                        # eslint
npm run build                       # production build into dist/
npx playwright install chromium     # one-time; the browser for e2e
npm run e2e                         # starts Django + Vite (or reuses them), runs e2e/
```

## Project Structure

```
pc-flipper-toolkit/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── config/            Django project: settings.py, urls.py
│   └── builds/            The one Django app: models, serializers, views, tests.py;
│                          auth.py (accounts), authentication.py (token checks), demo.py (sample builds),
│                          prices.py + test_prices.py (price lookup)
├── frontend/
│   ├── vite.config.ts     Includes the /api dev proxy
│   ├── e2e/               Playwright: the main flow, trying the demo, and the price lookup
│   └── src/
│       ├── api.ts         fetch helpers and TS types matching the API
│       ├── money.ts       ₱ formatting
│       ├── pages/         BuildsList.tsx, BuildDetail.tsx, Login.tsx
│       └── components/    PartsTable.tsx, ExtraCosts.tsx, Summary.tsx, ...
├── docs/intent/           Confirmed statements of intent (the app, e2e tests, demo account)
├── docs/specs/            Specs for later features built on this one (price lookup)
├── SPEC.md
└── README.md              Screenshot, live links, how to run
```

## Code Style

Calculations live on the model and are plain Python with Decimal:

```python
class Build(models.Model):
    ...
    @property
    def total_cost(self) -> Decimal:
        return self.parts_cost + self.extra_costs_total

    @property
    def profit(self) -> Decimal | None:
        if self.selling_price is None:
            return None
        return self.selling_price - self.total_cost
```

- Python: Ruff defaults, `snake_case`, type hints on public functions, DRF `ModelViewSet` + router (no custom views unless needed).
- TypeScript: function components, `PascalCase.tsx` for components, `camelCase` otherwise, no `any`.
- Tailwind utility classes in JSX. No separate CSS files except Tailwind's entry file.
- Keep it boring: no state library (React state + fetch is enough for v1), no extra UI kit unless approved.

## Testing Strategy

- **Backend (this is where most tests go):** `builds/tests.py`
  - Accounts: sign up, log in, log out; and isolation: one user can't list, read, edit or delete another user's builds, parts or extra costs, or add a part to their build.
  - Every value in `totals`, including edge cases: no parts, no selling price, selling price of 0, a negative profit (a loss), and decimal rounding.
  - API: create, read, update and delete for builds, parts and extra costs; rejects negative prices; deleting a build also deletes its parts and extra costs.
- **Demo accounts:** the sample builds' totals match hand-calculated values (so a later feature
  can't quietly break them); a demo user older than 24 hours gets 401 and is deleted by the
  next demo request; a real user named `demo-…` with a password is never deleted; sign-up
  refuses `demo-`; demo creation counts toward the shared rate limit.
- **Frontend:** a small set of Vitest tests: `₱` formatting, and the Summary component rendering the totals it's given (including `null` → "—").
- **Manual check per task:** run both servers and click through the flow on desktop and at phone width.
- No coverage % target. The profit calculation must be fully tested.

## Boundaries

- **Always:** run the backend and frontend tests before every commit; keep money as Decimal (never float); compute totals only on the backend; validate that prices are ≥ 0; keep `SPEC.md` updated when a decision changes; document every new or changed endpoint in the same change (summary, description, field `help_text`, and an example for non-trivial responses). The schema test (`spectacular --validate --fail-on-warn`) must pass.
- **Ask first:** adding any dependency not listed above; changing the data model after the first migration ships; changing the deployment target; adding any feature from Out of scope.
- **Never:** commit secrets or `.env` files (use environment variables); store money as float; remove or skip a failing test to get to green.

## Success Criteria

1. One real flip, with at least 6 parts and 2 extra costs, can be entered end to end, and its profit matches a hand calculation to the centavo.
2. Every value in `totals` is covered by backend tests, and all tests pass.
3. On the live site, every request without a login is rejected (401), and two accounts never see each other's builds.
4. The builds list and build detail pages are usable at 375px width without horizontal scrolling.
5. The frontend is live on Vercel and the API on Render, both reachable by public link, and data survives a backend restart or redeploy.
6. The README has a screenshot, the live link, and setup steps that work on a fresh clone.
7. A bundle (3 parts, one price, one part's bought-for typed in) on the live site fills those
   three checklist slots, counts its price once in the totals (matching a hand calculation),
   shows the unassigned amount, and is usable at 375px.
8. On the live site, "Try the demo" shows both sample builds within one click (after Render
   wakes up), and two demo sessions in separate browsers never see each other's changes. The
   24-hour expiry and cleanup are proven by backend tests, not on the live site.

## Open Questions

None. Resolved: TypeScript (yes), `sold_at` (keep), PostgreSQL in dev and prod (yes), and
multiple users with their own accounts (yes; this replaced the earlier single-user access key).

Build order preference: keep it minimal and visible. Get the smallest working page on screen
first, then add features one at a time.
