# Testing

Set up the API and the frontend first ([getting started](getting-started.md)).

## Unit tests, lint and build

```sh
(cd backend && .venv/bin/python manage.py test && .venv/bin/ruff check . && .venv/bin/ruff format --check .)
(cd frontend && npm test && npm run lint && npm run build)
```

## End-to-end

Playwright tests in [`frontend/e2e/`](../frontend/e2e/) sign up and flip a PC (loose parts and
a bundle, pricing, totals, checklist, delete), try the demo, and check the price lookup and the
landing page, at desktop and phone width. They start Django and Vite themselves (or reuse ones
already running) on your local database.

```sh
(cd frontend && npx playwright install chromium && npm run e2e)
```

Sign-up, log-in and Try the demo share a limit of 10 a minute, so many runs in a row get
"Too many attempts" for a minute.

## The README's screenshots

[`frontend/scripts/readme-screenshots.mjs`](../frontend/scripts/readme-screenshots.mjs) takes
them from the running app with a fresh demo account, into [`docs/images/`](images/). It needs
the API and Vite running, and shop prices in your database for the price lookup.

```sh
(cd frontend && node scripts/readme-screenshots.mjs)
```
