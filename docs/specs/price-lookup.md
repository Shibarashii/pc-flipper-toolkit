# Spec: Price lookup (v1: PC shops)

A separate feature on top of [SPEC.md](../../SPEC.md), which stays the source of truth for
everything else (stack, auth, money rules, code style).

[Part 2](#part-2-part-search-pop-up) adds a search pop-up to the Part box that uses the same
shop copy.

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

1. In the part form (add or edit, including a bundled part), a **"Find prices"** button at the
   bottom of the form opens a search prefilled with the part's name. I can edit the search text.
2. Results show each product's full name, shop, price, an "Out of stock" tag when it is, and a
   link to the product page (new tab). In-stock items come first, then cheapest first.
3. Choosing a result fills Listed price and Shop (e.g. `EasyPC`) and closes the search. The name,
   category and bought-for are untouched, and nothing is saved until I press Save, as usual.
4. The search says when its prices are from ("Prices from Oct 29", like the app's other dates).
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
  title        text            the shop's product name, with symbols that the shop's own
                               data garbled fixed ("IntelÂ®" → "Intel®"; 375 EasyPC titles)
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

- "Find prices" is a secondary button with a search icon, on its own strip at the bottom of
  the form's sunken box (a `line` hairline above it), with a muted hint beside it: "Fill in the
  price and shop from EasyPC or PC Express." It sits inside the box so it reads as part of the
  form, and on its own strip because the compact add row hides its labels on desktop and has
  no room by Listed price. The hint hides while the panel is open. The panel opens on that
  strip (full width) with a search box (prefilled, focused), Search and Close, and the
  results as a hairline-divided list (hover fill: `surface`, since it sits on `sunken`).
  Enter in the search box searches; it never saves the part. A part name under 2 characters isn't searched until the user types more.
- Choosing a result moves the focus to Listed price, so it can be adjusted; closing the
  panel moves it back to "Find prices".
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

- **Backend (`builds/test_prices.py`)**, with `urlopen` mocked to return small fixture catalogues.
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
- **E2E (`e2e/prices.spec.ts`):** Enter in the search box searches and doesn't save the part,
  and Esc closes only the panel. jsdom never submits a form on Enter, so only a browser can
  test it. It passes with or without a shop copy (CI's database has none).
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

---

# Part 2: Part search pop-up

Builds on part 1's `ShopProduct` copy and `/api/prices/`. Agreed with the author on 2026-10-29.

## Objective

Typing a part's name is slow, and "Find prices" was easy to miss. Typing 2+ letters in the
part form's **Part** box opens a pop-up of matching EasyPC and PC Express products. Picking
one fills three fields at once: **Part** (a short name), **Listed price** and **Shop**.

- **User:** the flipper entering a whole build part by part (demo accounts too).
- **It's a suggestion:** all three fields stay editable. Ignoring the pop-up and typing
  works exactly as before. Second-hand parts (e.g. from Facebook Marketplace) are often not in
  the shops, so the pop-up must never get in the way of typing.

### User stories

1. In the part form (add or edit, including a bundled part), typing 2+ characters in Part
   shows up to 8 matching products under the box after a short pause.
2. Each row shows the short name (what gets filled in), the shop's full name under it so I can
   tell exactly which product it is, the price and shop, and "Out of stock" when it is.
3. Picking a row fills Part with the short name, Listed price with its price and Shop with its
   shop. Category, Bought for and Bundle are untouched. Nothing is saved until Save.
4. If nothing matches, the copy is empty, or the request fails, no pop-up appears. The user
   just keeps typing; there's no error message in the way.
5. "Find prices" (part 1) stays, for an existing part or a different product's price.

### Short names

Shop titles are long ("MSI GeForce RTX™ 3060 VENTUS 2X OC 12GB GDDR6 192-bit Graphics Card").
`shorten(title)` in `prices.py` makes a short name with plain rules, in order:

1. Drop ™ ® ©.
2. Drop anything in brackets (SKUs, colours, fan lists). This comes before step 3 because a
   bracket can hold a separator. A "(" with no ")" (a cut-off title) drops the rest.
3. Cut at the first ` / `, `/`, ` | `, `, `, ` - `, ` with ` or ` + `. These start spec lists
   (prebuilts, laptops), marketing tails and combos.
4. Drop:
   - "NVIDIA", "GeForce", "Radeon"
   - part codes with 2+ hyphens (`GV-N3060EAGLE-12GD`)
   - SKU-like tokens of 12+ characters with 3+ digits and 3+ letters (`KF552C40BBK2-32`)
   - GDDR types, bus widths (`192bit`), "LHR", GHz speeds
   - "Graphics Card", "Videocard", "Socket", "Processor", "Motherboard", "Memory", "Desktop",
     "CPU", "Power Supply"
   - "Gaming", unless it's part of a model name: after "TUF" or "Phantom", or before "OC", "X",
     "Trio", "Pro", "Plus", "Slim", "D", a number or "WiFi" ("GAMING X TRIO", "Phantom Gaming
     4", "B550 Gaming Plus")

   "Solid State Drive" becomes "SSD".
5. Collapse spaces and keep at most 10 words. Seven words cut 36% of titles and lost details
   like a card's "8GB"; 10 cuts 8%, and the average short name is 6.8 words.
6. Trim a joining symbol the word cap leaves at the end ("MU-MIMO&" becomes "MU-MIMO").
   "80+" stays.

Tried on the local copy of all 10,085 titles (2026-10-29). Graphics cards, RAM and power
supplies come out clean; motherboards are about 5 in 8, since their titles carry marketing
text. Examples:

| Shop title | Short name |
|---|---|
| Palit NVIDIA® GeForce RTX™ 3060 Dual NE63060019K9-190AD-V1 12gb 192bit GDdr6 Gaming Videocard LHR | Palit RTX 3060 Dual 12gb |
| Asus TUF Nvidia Geforce RTX 4080 Super TUF-RTX4080S-O16G-GAMING 16GB 256bit GDDR6 Videocard | Asus TUF RTX 4080 Super 16GB |
| Kingston Fury Beast KF552C40BBK2-32 32GB 2x16 5200MT/s DDR5 Memory Black XMP | Kingston Fury Beast 32GB 2x16 5200MT |
| Gigabyte B550M-K Socket Am4 Ddr4 Motherboard | Gigabyte B550M-K Am4 Ddr4 |
| Coolermaster MWE550 V2 Power Supply 550watts | Coolermaster MWE550 V2 550watts |
| Asus Prime H610M-D D4 Socket LGA 1700 Comprehensive cooling, Ultrafast … Motherboard | Asus Prime H610M-D D4 LGA 1700 Comprehensive cooling (bad) |

The short name is what gets saved, since part names show in narrow table columns, phone
cards and the checklist. A bad short name costs a few keystrokes: the user sees it, with the
full name under it in the pop-up, and edits it before saving. The
rules get tuned by adding a test case, not by matching on categories.

### Out of scope (part 2)

Filling Category (the copy doesn't store it; that would be a data-model change); suggesting
the user's own past part names; outside parts data (PCPartPicker has no API and forbids
scraping, the open datasets are from 2024, Icecat looks up by product code); renaming
"Listed price" to "Market price".

## API change

`/api/prices/` results gain one field, `short_title`, computed by `shorten()` when the
response is built. It's additive: the table, the matching, the order and the 20-result cap stay
the same. The pop-up shows the first 8.

```json
{"shop": "PC Express", "title": "MSI GeForce RTX™ 3060 VENTUS 2X OC 12GB GDDR6 192-bit Graphics Card",
 "short_title": "MSI RTX 3060 VENTUS 2X OC 12GB", "url": "…", "price": "26000.00", "in_stock": true}
```

## Screens

- **The Part box becomes a combobox** (the WAI-ARIA 1.2 "combobox with listbox popup"
  pattern):
  - The input gets `role="combobox"`, `aria-expanded`, `aria-controls` and
    `aria-activedescendant`.
  - The pop-up is a `role="listbox"` of `role="option"` rows.
- **Placement:** the pop-up sits right under the Part box, over the fields below it. It is as
  wide as the box, with a 320px minimum on desktop's compact add row. It scrolls past 320px tall.
- **Style:** `surface` background, 1px `line-strong` border, 4px radius (it's a control),
  hairlines between rows and no shadow, per the brand.
  - Each row's short name is in body text, and the shop's full name is under it in small
    muted text (wrapping, never cut off).
  - The price (`formatMoney`, tabular) and shop are in small muted text.
  - "Out of stock" uses the outlined tag.
  - The active row has a `sunken` fill.
- **When it searches:** 300 ms after the last keystroke, only while the box has 2+
  characters. Only the newest request's answer counts. It opens only from typing, never just
  from focusing the box.
- **Keys:**
  - Down/Up move through the rows.
  - **Enter picks only when a row is active; otherwise Enter saves the part, as today.**
  - Esc closes the pop-up only; a second Esc cancels the edit.
  - Tab and clicking elsewhere close it without picking.
- **Screen readers:** a visually hidden status line says when rows appear ("8 products found.
  Use the up and down arrows to choose."), since a change to `aria-expanded` isn't announced
  reliably. New rows clear the highlighted row, because its old position may not exist.
- **Picking** fills the three fields, closes the pop-up and keeps the focus in Part with the
  cursor at the end, so the name can be trimmed.
- **After a save in the add row** (which stays open for the next part), the pop-up is closed.
- **375px:** full width under the box; rows wrap; no horizontal scroll.

## Project Structure (part 2)

```
backend/builds/
  prices.py                         + shorten()
  serializers.py                    + short_title
frontend/src/
  api.ts                            + short_title on ShopProduct
  components/PartSearch.tsx         the Part combobox
  components/PartRow.tsx            uses PartSearch for Part
```

## Testing Strategy (part 2)

- **Backend:**
  - `shorten()` gets a table of real titles and their expected short names (the examples
    above, plus one per rule).
  - `/api/prices/` returns `short_title`.
- **Frontend (Vitest, fake timers):**
  - No request under 2 characters, or before the pause.
  - Rows show the short name, full name, price, shop and stock.
  - Down + Enter fills name, price and shop and doesn't save.
  - Enter with no active row saves.
  - Esc closes only the pop-up.
  - An older answer can't replace a newer one.
  - A failed request shows nothing and typing still works.
  - The ARIA attributes are set.
- **E2E:** in a real browser, Enter with no active row saves the part, and Down + Enter
  doesn't. CI's database has no shop copy, so the test gets results by routing
  `/api/prices/*` to a fixture with Playwright.
- **Manual:** desktop add row, desktop edit, and 375px, in light and dark.

## Boundaries (part 2)

- **Always:** part 1's rules; typing without the pop-up works exactly as before; Enter without
  an active row saves.
- **Ask first:** filling Category; storing short names in the table; any new dependency (no
  combobox library: the pattern is small enough to write).
- **Never:** call a shop from the browser; open the pop-up on focus alone; show an error that
  blocks typing.

## Success Criteria (part 2)

1. On production, typing "3060" in a new part's Part box shows matching products within
   about a second once Render is awake. Picking one fills Part, Listed price and Shop, all
   editable, and Save stores what's shown.
2. Typing a name and pressing Enter (no row active) saves the part, as before.
3. The pop-up works with the keyboard alone, and a screen reader announces the rows.
4. Graphics cards, RAM and power supplies in the examples get short names like the table
   above (backend tests).
5. Usable at 375px without horizontal scrolling, in light and dark.

## Open Questions

None.
