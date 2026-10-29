# Spec: Price lookup (v1: PC shops)

A separate feature on top of [SPEC.md](../../SPEC.md), which stays the source of truth for
everything else (stack, auth, money rules, code style).

## Objective

While adding or editing a part, I can search its name and see current prices from PC shops,
then pick one to fill the part's **listed price** and **shop**. It's a suggestion: I can still
type the price by hand, and if the lookup fails the part form works exactly as before.

- **User:** the flipper pricing a build (demo accounts get it too).
- **Why:** market prices are looked up by hand in other tabs today.
- **v1 shops:** EasyPC (easypc.com.ph) and PC Express (pcx.com.ph). Both are Shopify stores
  that publish their catalogue at `/products.json`, and both robots.txt files allow it.
  EasyPC's robots.txt disallows `/search`, so neither shop's search is used.

### How it works

1. Once a day, a GitHub Actions schedule runs `python manage.py refresh_shop_prices` against
   the production database. It downloads each shop's catalogue and keeps a slim copy in a
   `ShopProduct` table. Measured on 2026-10-29: EasyPC 7,303 products (30 pages, ~45 MB;
   only 118 in stock), PC Express 2,830; both together took 90 s and the table is 4.4 MB.
2. A search reads only that table. It never calls a shop, so it's fast, it works while a shop
   is down, and users can't make the app hit the shops.

Render's free tier has no cron, so GitHub Actions does the scheduling. Searching our own copy
also keeps the request count to the shops at about 60 a day in total, whoever uses the app.

### User stories

1. In the part form (add or edit, including a bundled part), a **"Find prices"** button next to
   Listed price opens a search prefilled with the part's name. I can edit the search text.
2. Results show each product's full name, shop, price, an "Out of stock" tag when it is, and a
   link to the product page (new tab). In-stock items come first, then cheapest first.
3. Choosing a result fills Listed price and Shop (e.g. `EasyPC`) and closes the search. The name,
   category and bought-for are untouched, and nothing is saved until I press Save, as usual.
4. The search says when its prices are from ("Prices from 29 Oct").
5. No matches: "No matches at EasyPC or PC Express." A failed request: "Couldn't load prices.
   Type the price instead." Either way the form still works.

### Out of scope (this version)

Shopee and Lazada (Shopee later, through its official affiliate API once approved); price
history, tracking or alerts; product images; matching a part to a product automatically;
refreshing from the app; renaming "Listed price" to "Market price" (a separate change later).

## Data Model

New table only. Existing models don't change.

```
ShopProduct
  shop         text            "EasyPC" | "PC Express"
  title        text            the shop's product name
  url          text            product page, https://<shop>/products/<handle>
  price        decimal(10,2)   the cheapest variant's price; a product without a usable
                               price (₱0 placeholders, NaN, negative, too big) or with a
                               missing field is skipped, so it can't fail the whole shop
  in_stock     bool            any variant available
  updated_at   datetime        when this shop's copy was refreshed
  unique (shop, url)
```

Refreshing a shop replaces all its rows in one transaction, and only after every page
downloaded. If a page fails, or the shop returns no usable products at all, the old copy
stays and the command exits non-zero (so the GitHub run shows red). One shop failing doesn't
stop the other. A database error is logged by its type only, since the Actions logs are
public and its message can name the Neon server and user.

The shops are a constant in code, e.g. `SHOPS = {"EasyPC": "https://easypc.com.ph", ...}`.
Adding one is a code change plus a robots.txt and terms check.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/prices/?q=rtx 3060` | Up to 20 matching products from the copy |

```json
{
  "results": [
    {"shop": "PC Express", "title": "MSI GeForce RTX 3060 VENTUS 2X OC 12GB GDDR6",
     "url": "https://pcx.com.ph/products/...", "price": "26000.00", "in_stock": true}
  ],
  "updated_at": "2026-10-30T02:04:11+08:00"
}
```

- Matching: every word in `q` must appear in the title, case-insensitive (`rtx 3060` matches
  "RTX 3060 Ti" too; the user picks).
- Order: in stock first, then price ascending.
- `updated_at` is the oldest shop refresh time, or `null` before the first refresh. Like
  every time in the API, it's in Manila time (`+08:00`).
- `q` shorter than 2 or longer than 100 characters (after trimming) → 400 under `q`.
- Needs a token like every endpoint (401 without). It only reads our table, so it has no
  rate limit.
- Documented in drf-spectacular like the rest (summary, description, example).

## Fetching rules (being a polite client)

- Only `/products.json?limit=250&page=N`, which both robots.txt files allow. Never `/search`
  or any other path a robots.txt disallows.
- An honest user-agent naming the app and its repo URL. Never a browser user-agent, never
  anything that gets around a bot check, a captcha or a block. If a shop starts blocking, that
  shop's refresh fails and we stop and talk, not work around it.
- One request at a time, 1 second apart, a 30 s timeout, at most once a day per shop.
- HTTP with Python's built-in `urllib.request`: no new dependency.
- Prices are parsed from the JSON's strings into `Decimal`, never float.

## Screens

The part form (`PartForm` in `components/PartRow.tsx`) on desktop and at 375px:

- "Find prices" is a small link-style button next to the Listed price label. It opens a panel
  under the form row (full width, stacked on mobile) with a search input (prefilled, focused)
  and the results list.
- Each result is a button (choose) plus a separate "View" link to the shop page. Price uses
  `formatMoney`, "Out of stock" uses the muted text style.
- States: loading, results, no matches, failed (message above), and no copy yet
  (`updated_at` null: "Prices aren't loaded yet.").
- Esc or a Close button closes the panel without changing anything. Esc in the panel must not
  also cancel the part edit.
- Follows [docs/brand-guidelines.md](../brand-guidelines.md).

## Commands

```
python manage.py refresh_shop_prices            # backend/; refresh every shop's copy
python manage.py refresh_shop_prices --shop EasyPC
gh workflow run refresh-prices.yml              # run the production refresh now
```

The workflow `.github/workflows/refresh-prices.yml` runs daily at 18:00 UTC (2am in the
Philippines) and on demand (`workflow_dispatch`). It needs one repository secret,
`DATABASE_URL` (Neon's connection string). Nothing else from production.
GitHub turns off scheduled workflows after 60 days without repo activity; re-enable it in the
Actions tab if that happens.

## Project Structure

```
backend/builds/
  prices.py                         fetch + parse a shop catalogue, replace its rows, search
  management/commands/refresh_shop_prices.py
  models.py                         + ShopProduct; migration 00xx_shopproduct
  views.py                          + the /api/prices/ view
frontend/src/
  api.ts                            + findPrices(q), ShopProduct type
  components/PriceLookup.tsx        the search panel
  components/PartRow.tsx            "Find prices" button, fills listed price + shop
.github/workflows/refresh-prices.yml
```

## Testing Strategy

- **Backend (`builds/tests.py`)**, with `urlopen` mocked to return small fixture catalogues.
  No test touches a real shop.
  - Parsing: cheapest variant price as `Decimal`, `in_stock` from any variant, url from the
    handle, paging until an empty page.
  - Refresh: replaces a shop's rows; a failed page or zero products keeps the old copy and
    exits non-zero; one shop failing still refreshes the other; requests send the app's
    user-agent and only hit `/products.json`.
  - Search: all words, case-insensitive; ordering; at most 20; `updated_at` (and `null` when
    empty); 400 for a short `q`; 401 without a token.
- **Frontend (Vitest):** opening the panel prefills the part name; choosing a result fills
  listed price and shop without saving; the failed and no-matches messages; Esc closes the
  panel but keeps the edit open; typing a price by hand still works with the lookup unused.
- **E2E:** none for v1 (CI's database has no shop copy). Covered by the Vitest tests and a
  manual check on the live site.
- **Manual:** run the command locally once against the real shops, then search on desktop and
  375px.

## Boundaries

- **Always:** follow the fetching rules above; keep money as Decimal; keep the lookup optional
  (manual typing always works); keep the Neon URL only in the GitHub secret and Render, never in
  the repo or logs.
- **Ask first:** adding a shop; adding Shopee or Lazada; any new dependency; storing more
  than the fields above (e.g. images or descriptions).
- **Never:** call a shop from the browser or during a user's request; use a browser
  user-agent or get around a block; fetch a path robots.txt disallows.

## Success Criteria

1. After the scheduled refresh on production, searching "rtx 3060" in a part form shows results
   from both EasyPC and PC Express within 2 seconds (once Render is awake).
2. Choosing a result fills listed price and shop. They can be edited before saving, and saving
   stores exactly what's shown.
3. Adding a part by typing the price, without the lookup, works exactly as before.
4. Backend tests prove a failed refresh keeps the previous copy, and that only allowed paths are
   requested with the app's user-agent.
5. The GitHub workflow runs green daily, and each run fetches each shop once.
6. The panel is usable at 375px without horizontal scrolling.

## Open Questions

None. Resolved: no warning when the copy is old, just the "Prices from" date (2026-10-29).
