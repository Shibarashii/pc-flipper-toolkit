# Spec: Part condition

A new optional field on parts, on top of [SPEC.md](../../SPEC.md), which stays the source of
truth for everything else. Agreed in conversation on 2026-11-07.

## Objective

Each part can be marked with its condition: **New**, **Used – Like New**, **Used – Good** or
**Used – Fair**. These are Facebook Marketplace's four condition labels, in its order.

- **Why:** Facebook gives a listing one condition, so a build with a new GPU and a used CPU
  can't say which is which. The post text has to.
- **Users:**
  - Buyers read each part's condition in the [Copy listing](copy-listing.md) post.
  - The seller sees at a glance which parts of a build are new and which are used.
- **Optional:** blank by default. Parts that exist before this ships stay blank, and a blank
  condition shows nothing anywhere.

### Where it shows

- **Part form (add and edit):** a Condition select after Category. Its options are
  "Not set" (blank), then the four labels.
- **Parts table:** a short muted label right after the part's name, on phones and desktop:
  "New", "Like new", "Good" or "Fair". No new column. Bundled parts show it too, since they
  use the same row.
- **Copy listing post:** the full label in brackets after the name:

  ```
  CPU: Ryzen 5 5600 (New)
  GPU: RX 6600 8GB (Used – Like New)
  RAM: 2× 8GB DDR4 3200 (Used – Good)
  Storage: 1TB NVMe SSD
  ```

  - Repeated parts group as `2× …` only when both their name and condition match. Otherwise
    they're joined with ` + `, e.g. `RAM: 8GB DDR4 (New) + 8GB DDR4 (Used – Good)`.
  - A build whose parts have no condition gets exactly the post it gets today.
- **Demo account:** the sample builds' parts get conditions, a mix of new and used, so the
  feature shows on the demo. The bundle's parts from Facebook Marketplace are used; parts
  from shops are new.

### User stories

1. Adding a part, I pick "Used – Like New"; the row shows "Like new" after its name.
2. Editing a part, I change its condition, or set it back to "Not set"; the row follows.
3. Copy listing shows each part's condition in brackets; parts without one have no brackets.
4. Existing builds and their posts look as before until I set a condition.
5. It fits a phone (375px) without horizontal scrolling, in the form and the table.

### Out of scope

- A condition for the whole build (worked out from its parts, or "refurbished"). Goes to the
  backlog as its own idea.
- Filtering or sorting by condition.
- Condition changing prices, totals, profit or the price lookup.
- The local wording ("Barely used", "2nd hand").
- Remembering the last condition picked: after adding a part, the form clears it like the
  other fields.

## Data model

```python
class Part(models.Model):
    class Condition(models.TextChoices):
        NEW = "new", "New"
        LIKE_NEW = "like_new", "Used – Like New"
        GOOD = "good", "Used – Good"
        FAIR = "fair", "Used – Fair"

    condition = models.CharField(
        max_length=8, choices=Condition, blank=True, db_default=""
    )
```

- Blank is `""`, not `null`: Django's convention for text, so there's one empty value.
- `db_default=""`, like `public_id`: migration `0008` adds the column with a database
  default, so existing rows get `""` with no backfill, and the old code's inserts during the
  deploy (which don't know the column) don't fail.
- No index: nothing filters by it.

## API

- `condition` on every part: `"new" | "like_new" | "good" | "fair"`, or `""` when not set.
- Optional on create (missing means `""`); `PATCH` can set or clear it. Any other value is a
  400 on `condition`, with DRF's choice message.
- API docs: the field's help text lists the values and says blank means not set.
- The build detail, builds list, summary and price search don't change otherwise.

## Frontend

```ts
// api.ts, beside CATEGORIES
export const CONDITIONS = {
  new: "New",
  like_new: "Used – Like New",
  good: "Used – Good",
  fair: "Used – Fair",
};
export type PartCondition = keyof typeof CONDITIONS;
// Part gains: condition: PartCondition | "";
```

- The table's short labels ("Like new", "Good"…) live next to the row that shows them.
- `listingText` turns each part into `name` or `name (label)` first, then groups those
  strings as today, so matching name and condition is what groups.

## Commands

Same as [SPEC.md](../../SPEC.md#commands): `python manage.py test`,
`python manage.py makemigrations --check`, `ruff check . && ruff format .` and
`python manage.py spectacular --validate --fail-on-warn` in `backend/`; `npm test`,
`npm run lint`, `npx tsc -b` and `npx playwright test` in `frontend/`.

## Project Structure

```
backend/builds/
  models.py              + Part.Condition, Part.condition
  migrations/0008_…      adds the column with DEFAULT ''
  serializers.py         condition in PartSerializer, with help text
  demo.py                conditions on the sample parts
  tests.py               + the tests below
frontend/src/
  api.ts                 CONDITIONS, PartCondition, Part.condition
  components/PartRow.tsx Condition select in PartForm; label in PartItem
  listing.ts             condition in the post; grouping by name and condition
  test/fixtures.ts, *.test.*   condition on test parts
frontend/e2e/flip.spec.ts  sets a condition on one part and checks the row
SPEC.md                  Part's condition in Data Model; Screens mention it
docs/ideas/backlog.md    the idea moves here; + build condition idea
```

## Testing Strategy

- **Backend:**
  - Create without `condition` gives `""`; create and `PATCH` with each value saves it;
    `PATCH` with `""` clears it; an unknown value is a 400 on `condition`.
  - A raw insert without the column's value gets `""` (the deploy case, as with `public_id`).
  - The demo's sample builds have both new and used parts (the existing demo test).
- **Frontend:**
  - `listingText`: condition in brackets; none when blank; same name with the same condition
    groups as `2×`, with different conditions doesn't.
  - Part form: picking a condition sends it; editing shows the saved one and "Not set"
    sends `""`; adding clears it for the next part.
  - Parts table: the short label shows after the name; a blank condition shows nothing.
- **E2E:** the flip spec picks a condition for one part and sees its label in the table.

## Boundaries

- **Always:** keep it optional; keep the post unchanged for parts without a condition; use
  Facebook's labels in the post.
- **Ask first:** more values, making it required, a build-level condition, showing it in
  other places (summary, builds list).
- **Never:** let condition change any money; guess a condition for existing parts.

## Success Criteria

1. A part's condition can be set, changed and cleared from the part form, and the table shows
   it after the name.
2. The Copy listing post shows each set condition in brackets, and groups repeated parts only
   when name and condition match.
3. After the deploy, existing parts are blank and their builds' posts are unchanged, and
   nothing failed during the deploy.
4. All tests pass (backend, frontend, e2e), and the API docs validate and list the values.

## Open Questions

None. Decided 2026-11-07: Facebook's four labels, optional, short labels in the table,
brackets in the post, build-level condition out of scope.
