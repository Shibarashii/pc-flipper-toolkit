# Part bundles

## Problem Statement
How might we record parts bought together for one price — keeping the build's totals right
and its checklist complete — without making up a price for each part?

## Recommended Direction
A build can have bundles. A bundle has a name, a shop and one bought-for price. Parts are
added inside it like any part — name, category, listed (market) price — but their bought-for
is optional and typed by hand. Totals count the bundle's price once; typed amounts on bundled
parts are a breakdown, never added again, and can't exceed the bundle price (the rest shows as
"not assigned"). The checklist is unchanged: bundled parts fill their own slots by category.

Considered and set aside: one bundle row that ticks several slots (loses per-part names), an
automatic split of the price by market share (the author prefers typed-in prices), and a
"purchases/orders" model where every part belongs to a purchase (right long term, too big now).

## Key Assumptions to Validate
- [x] Each bundled part's market price is known — confirmed by the author.
- [ ] Typed per-part prices get used sometimes — if never, drop them later.
- [ ] Grouped rows stay readable on a phone — screenshot the parts cards at 375px.

## Decisions
1. Shipping on a bundle stays an extra cost, not part of the bundle price.
2. Deleting a bundle deletes its parts, after a confirmation that names them.
3. An existing part can be moved into a bundle by editing it; moving one out needs a bought-for.
4. A bundle with no parts yet is allowed; its price still counts.

## MVP Scope
In: bundle create/edit/delete; add, edit and move parts in and out of a bundle; totals;
grouped parts table (desktop and phone); "₱X not assigned".
Out: everything below.

## Not Doing (and Why)
- Automatic price split — the author chose typed-in prices; no numbers the app made up.
- Selling a bundled part separately — doesn't happen in real flips.
- A full "purchases/orders" model — the right long-term shape, but reworks every part.
- Bundles shared across builds — a bundle goes into one PC.

## Open Questions
- None blocking.
