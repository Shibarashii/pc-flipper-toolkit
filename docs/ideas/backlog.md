# Ideas backlog

Rough ideas and parked decisions, not brainstormed or specced yet. When one is picked up, it
gets a one-pager in this folder (like [part-bundles.md](part-bundles.md)) or a spec in
[docs/specs/](../specs/), and moves out of this list.

## Rough ideas

### Copy listing (specced 2026-11-07)

Moved to [docs/specs/copy-listing.md](../specs/copy-listing.md).

### Builds summary (specced 2026-11-06)

Moved to [docs/specs/builds-summary.md](../specs/builds-summary.md).

### Stats screen (step 2 after the builds summary, added 2026-11-06)

A separate screen to compare months: profit per month as a chart, maybe a month picker.
Waits until there are 3+ months of sold builds to compare; before that it shows one bar and
zeros. Days to sell could go here too, but the app only knows when a build was added, not when
its first part was bought.

### Parts inventory (added 2026-11-06)

Parts bought but not in a build yet, like a GPU bought cheap for a future flip. Useful, but
it's a new kind of record, so it leans toward bloat. Not clear yet how it should work. To
brainstorm.

### A part's condition (specced 2026-11-07)

Moved to [docs/specs/part-condition.md](../specs/part-condition.md).

### Account page: profile and currency (added 2026-11-07)

After Google sign-in adds the Account page ([spec](../specs/google-sign-in.md)): edit the
profile (e.g. change the username) and choose the currency. Currency is the bigger one: the
whole app formats ₱ today (`money.ts`, the post, the summary). To brainstorm.

### Copy listing right after saving a part (added 2026-11-07)

Found during Checkpoint 13: opening Copy listing within a moment of saving a part can show
the part as it was, because the page refetches the build after the save returns. A real tap
is usually slower than the refetch. Fix if it's ever seen: build the post from the saved
part, like the header's price already does.

### Get ready for a portfolio (added 2026-11-19)

The app is feature-complete enough to show; more features wouldn't make it more convincing.
Before sharing it, after the author's own nits and wording fixes:

- **README:** "Known limits" still says "No email or password reset (out of scope for v1)",
  which is wrong since account management. Add accounts (Google sign-in, a confirmed email,
  changing the username and password, "Forgot your username or password?") and email
  (Brevo) to what it describes and its Stack table.
- **The first load:** Render's free plan sleeps after 15 minutes idle, so a first click can take
  up to a minute. The README warns about it; open the site a minute before sharing the link at
  a set time.
- **A 30-second story:** the problem it solves, and two or three choices worth pointing at, e.g.
  exact money (`Decimal`, strings in JSON), polite shop-price fetching, and a reset that never
  says whether an account exists.

### A landing page (added 2026-11-21, to plan)

A public page at `/` for logged-out visitors, instead of the redirect to `/login`. Today a
crawler only finds the login form, a heading and one sentence, so nothing ranks for searches
like "PC flip profit tracker"; the share card (`og:*`) only shapes shared links, not ranking.
What it says, what it shows (the builds list, the profit) and how it leads to "Try the demo" are
for the interview. It also settles the canonical: `/` would finally be the page it claims to be.

### SEO fixes (added 2026-11-21)

Small fixes, found checking the live site; none needs the landing page:

- **Canonical:** every route says `<link rel="canonical" href="/">`, `/privacy` included, so
  Google may never index `/privacy` on its own. Each public page should name itself.
- **Soft 404s:** `vercel.json` rewrites every path to `index.html`, so unknown URLs
  (`/sitemap.xml`, `/anything`) return 200. Google counts them as soft 404s.
- **A sitemap:** none yet; a static `public/sitemap.xml` with the public pages, linked from
  `robots.txt`.
- **Page titles:** every page is "PC Flipper Toolkit". A title per page ("Log in · PC Flipper
  Toolkit", the build's name…) helps search results and tabs, and screen readers announce it
  when the page changes.
- **`noindex`** on `/account`, `/verify-email` and `/reset-password`.
- **A domain of our own** would also make the site's name stand out more than `vercel.app`;
  see the parked email domain below (same domain, a deploy change, so ask first).

## Parked

- **A domain of our own for email** (parked 2026-11-18). Emails go through Brevo from
  `pcflippertoolkit@gmail.com`. Brevo can't sign as gmail.com, so recipients see a
  `…brevosend.com` sender with the Gmail address as Reply-To, and mail-tester scored a realistic
  email 5.5/10 (SpamAssassin's `FREEMAIL_FORGED_REPLYTO` and `HEADER_FROM_DIFFERENT_DOMAINS`,
  about −2.75). Gmail put the test in the inbox, so it was accepted for now. A domain (about $10
  a year), authenticated in Brevo's Domains tab and sending from `noreply@…`, should fix it;
  only `DEFAULT_FROM_EMAIL` changes. Revisit if anyone says an email never arrived, or to make
  the project look more polished.
- **A build's condition** (added 2026-11-07, parked 2026-11-12). One condition for the whole
  build, for Facebook's Condition field, or a "Refurbished" tag. Not needed: with mixed parts,
  Facebook's Condition is the worst part's, which the seller can tell at a glance, and the
  Copy listing post already shows each part's condition. "Refurbished" is the seller's claim,
  not something the parts say, and it fits in the build's name ("Refurbished i5-12400F +
  RTX 3060"), the post's first line. Revisit if Facebook's Condition is picked wrong, or
  "Refurbished" gets typed into names often.
- **Rename "Listed price" to "Market price"** (2026-10-29). Open question: the UI label only,
  or also the API's `listed_price` field (a data model and API change)?
- **Shopee prices** (2026-10-29), through Shopee's affiliate API once the author is approved.
  No scraping. Lazada after that.
- **Show "Find prices" only when editing a part** (2026-10-31, on hold). Adding has the Part
  search pop-up, so Find prices mainly helps update an existing part's price without renaming
  it. The hint would become "Update the price and shop without changing the name." Adding would
  lose the "View" link and the "Prices from" date, which the pop-up doesn't show.
- **Figma "Add part row" frame** (2026-10-31) is out of date: adding a part now uses the two
  labelled rows of the edit form (#43).
