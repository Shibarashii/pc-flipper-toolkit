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

## Parked

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
