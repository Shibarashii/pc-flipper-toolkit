# Spec: PC Flipper Toolkit (v1: Build Profit Tracker)

Source of intent: [docs/intent/pc-flipper-toolkit.md](docs/intent/pc-flipper-toolkit.md)

## Objective

A web app for one person who buys PC parts, assembles them, and sells the whole PC.
Each flip is a **build**. For every build the app shows what the parts are worth on the
market, what they actually cost, the true profit after extra costs, and how far below
market the PC is priced. It replaces the author's spreadsheet.

### User stories

1. I can create a build with a name and see it in a list of all my builds.
2. I can add parts to a build: name, category, shop, **listed price** (market price, e.g. Shopee) and **bought for** (what I actually paid).
3. I can add extra costs to a build: a label and an amount (shipping, platform fee, thermal paste, cables).
4. I can set a selling price and a status (planning → building → listed → sold).
5. On a build, I see these totals:
   - **Listed total:** sum of the parts' listed prices
   - **Parts cost:** sum of the parts' bought-for prices
   - **Extra costs:** sum of the extra costs
   - **Total cost:** parts cost + extra costs
   - **Profit:** selling price − total cost (blank if there's no selling price yet)
   - **Profit margin:** profit ÷ selling price, as a %
   - **Below market:** listed total − selling price, in ₱ and as % of the listed total
   - **Voucher savings:** listed total − parts cost
6. On the builds list, I see each build's status, total cost, selling price and profit.
7. I can edit and delete builds, parts and extra costs.
8. Everything works on a phone-sized screen.

### Out of scope (v1)
Price scraping, voucher detection, buyer-only build mode, multiple users or accounts, part
compatibility checks, multiple currencies (amounts are in PHP ₱ only).

## Tech Stack

| Layer | Choice |
|---|---|
| Backend | Python 3.14, Django 6.0, Django REST Framework, django-cors-headers, psycopg 3, dj-database-url, python-dotenv, drf-spectacular (OpenAPI docs) |
| Database | PostgreSQL everywhere: local install (dev), Neon free tier (prod). Configured via `DATABASE_URL` |
| Frontend | React 19 + TypeScript, Vite, Tailwind CSS v4, React Router v8 |
| Backend tests | Django test runner (`manage.py test`) |
| Frontend tests | Vitest + React Testing Library |
| Lint/format | Ruff (Python), ESLint + Prettier (TS) |
| Deploy | Vercel (frontend), Render (backend) |

Exact versions get pinned in `requirements.txt` / `package.json` when the project is scaffolded.

## Data Model

```
Build
  name            text
  status          planning | building | listed | sold   (default planning)
  selling_price   decimal(10,2), nullable
  sold_at         date, nullable
  notes           text, blank
  created_at      datetime

Part             (belongs to Build, deleted with it)
  name            text            e.g. "Ryzen 5 7600"
  category        cpu | gpu | motherboard | ram | storage | psu | case | cooler | other
  shop            text, blank     e.g. "Shopee - DynaQuest"
  listed_price    decimal(10,2)   market price
  bought_for      decimal(10,2)   actual price paid

ExtraCost        (belongs to Build, deleted with it)
  label           text            e.g. "Shipping"
  amount          decimal(10,2)
```

Money is always `Decimal` in Python and serialized as a string in JSON (`"12500.00"`).
It is never a float. All prices must be ≥ 0.

## API

All endpoints are under `/api/`. JSON in, JSON out. Only `PATCH` is supported for updates (no `PUT`).

**Reference docs:** an OpenAPI 3 schema is generated from the code with drf-spectacular. Interactive docs (Swagger UI) are at `/api/docs/` and the raw schema at `/api/schema/`. This table is the overview, and `/api/docs/` is the source of truth for fields and examples.

| Method | Path | Purpose |
|---|---|---|
| GET, POST | `/api/builds/` | List builds (with totals) / create a build |
| GET, PATCH, DELETE | `/api/builds/{id}/` | Build detail, including `parts`, `extra_costs` and `totals` |
| POST | `/api/parts/` | Add a part (`build` id in the body) |
| PATCH, DELETE | `/api/parts/{id}/` | Edit / remove a part |
| POST | `/api/extra-costs/` | Add an extra cost (`build` id in the body) |
| PATCH, DELETE | `/api/extra-costs/{id}/` | Edit / remove an extra cost |

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

**Access key (write protection):** anyone can make GET requests. Requests that change data
(POST/PATCH/DELETE) must include the header `X-Access-Key`, and it must match the `ACCESS_KEY`
env var on the server. Otherwise the server returns 403. The frontend asks for the key once,
saves it in `localStorage`, and hides the edit controls when it's missing. This gets built
just before deployment, not first.

## Screens

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
   - Extra costs list: add, edit and delete, same inline pattern as parts.
   - Notes: a plain textarea under Extra costs that saves on blur.
   - Delete build: a confirmation dialog naming how many parts and extra costs will be deleted with it.

States each screen must handle:
- **Builds list:** no builds yet (message plus "New build").
- **Build detail:** no parts or extra costs yet, no selling price (profit and margin show "—"), a loss (red), and a validation error on a field (e.g. negative price).
- **Both:** loading, request failed, and read-only mode when no access key is saved. Read-only hides every edit control and shows an "Unlock editing" button in the header, which opens a dialog asking for the key.

Visual design (colors, type, components, light/dark) follows [docs/brand-guidelines.md](docs/brand-guidelines.md).
Builds are labeled `Build 01` (id zero-padded to 2 digits) in the UI.

Money is shown as `₱12,500.00` using `Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })`.

## Commands

Backend (from `backend/`, fish shell):
```
python -m venv .venv && source .venv/bin/activate.fish
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env               # one-time; edit values as needed
createdb pc_flipper_toolkit         # one-time; needs CREATEDB (tests create test_pc_flipper_toolkit)
python manage.py migrate
python manage.py runserver          # http://localhost:8000 · API docs at /api/docs/
python manage.py test               # run backend tests
ruff check . && ruff format .       # lint + format
```

Frontend (from `frontend/`):
```
npm install
cp .env.example .env               # one-time; set VITE_API_URL in production
npm run dev                         # http://localhost:5173, proxies /api → :8000
npm test                            # vitest run
npm run lint                        # eslint
npm run build                       # production build into dist/
```

## Project Structure

```
pc-flipper-toolkit/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── config/            Django project: settings.py, urls.py
│   └── builds/            The one Django app: models, serializers, views, tests.py
├── frontend/
│   ├── vite.config.ts     Includes the /api dev proxy
│   └── src/
│       ├── api.ts         fetch helpers and TS types matching the API
│       ├── money.ts       ₱ formatting
│       ├── pages/         BuildsList.tsx, BuildDetail.tsx
│       └── components/    PartsTable.tsx, ExtraCosts.tsx, Summary.tsx, ...
├── docs/intent/           Confirmed statement of intent
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
  - Every value in `totals`, including edge cases: no parts, no selling price, selling price of 0, a negative profit (a loss), and decimal rounding.
  - API: create, read, update and delete for builds, parts and extra costs; rejects negative prices; deleting a build also deletes its parts and extra costs.
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
3. On the live site, a write request without the access key is rejected (403), and reads still work.
4. The builds list and build detail pages are usable at 375px width without horizontal scrolling.
5. The frontend is live on Vercel and the API on Render, both reachable by public link, and data survives a backend restart or redeploy.
6. The README has a screenshot, the live link, and setup steps that work on a fresh clone.

## Open Questions

None. Resolved: TypeScript (yes), `sold_at` (keep), PostgreSQL in dev and prod (yes), and
write protection through an access key (yes).

Build order preference: keep it minimal and visible. Get the smallest working page on screen
first, then add features one at a time.
