# Deployment

The frontend runs on Vercel, the API on Render, and the database on Neon. Both redeploy on
every push to `main`.

## Render (the API)

- **Root:** `backend`
- **Build:** `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`
- **Start:** `gunicorn config.wsgi`
- **Environment:** `SECRET_KEY`, `ALLOWED_HOSTS`, `DATABASE_URL` (Neon), `CORS_ALLOWED_ORIGINS`
  (the Vercel URL), `NUM_PROXIES=3`. See [`backend/.env.example`](../backend/.env.example).

Render migrates before the new code serves, so a migration must work with the old code still
running.

## Vercel (the frontend)

- **Root:** `frontend`, Vite preset
- **Environment:** `VITE_API_URL`, set to the Render URL

[`vercel.json`](../frontend/vercel.json) sends every path to `index.html` so deep links work,
and its CSP's `connect-src` names the Render URL: change it together with `VITE_API_URL`, or
the browser blocks every API call.

## Shop prices

"Find prices" uses a copy of EasyPC's and PC Express's public catalogues, which
[`refresh-prices.yml`](../.github/workflows/refresh-prices.yml) refreshes daily at 2am
Philippine time ([spec](../specs/price-lookup.md)).

- **Setup:** one repository secret, `DATABASE_URL` (Neon's connection string), under
  Settings → Secrets and variables → Actions.
- **Run it now:** `gh workflow run refresh-prices.yml`, or "Run workflow" in the Actions tab.
- **If prices go stale:** GitHub turns scheduled workflows off after 60 days without activity
  in the repo, and the lookup's "Prices from" date stops moving. Re-enable it in the Actions tab.
