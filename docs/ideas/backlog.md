# Ideas backlog

Rough ideas and parked decisions, not brainstormed or specced yet. When one is picked up, it
gets a one-pager in this folder (like [part-bundles.md](part-bundles.md)) or a spec in
[docs/specs/](../specs/), and moves out of this list.

## Rough ideas

### Copy listing (intent agreed 2026-11-06, not specced)

A "Copy listing" action on a build. It writes a ready-to-paste Facebook Marketplace post from
what the app already knows: the build name, the parts grouped by slot (CPU, GPU, motherboard,
RAM, storage, PSU, case, cooler) and the selling price. The text is editable, then copied in
one click.

- **Why:** the app helps until the build is done, then stops. Writing the post is the one job
  a flipper repeats on every flip.
- **Success:** from a finished build to a pasted Marketplace post in seconds. The post never
  shows what was paid, the extra costs or the profit.
- **Constraint:** no data model change, no new screen, no new dependency. Edits aren't saved.
  With no selling price yet, the price line is left out.
- **Not doing:** each part's condition (waits for the idea below), tracking the sale (where
  it's posted, offers, days listed), photos, posting to Facebook directly, other marketplaces'
  formats.

### A part's condition (added 2026-11-04)

Mark each part as something like "brand new", "barely used" or "2nd-hand". Not sure yet what
to call it ("condition"?) or which values it should have. To brainstorm.

## Parked

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
