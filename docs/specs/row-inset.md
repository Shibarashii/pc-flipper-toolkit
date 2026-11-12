# Spec: Row inset

A visual fix on top of [SPEC.md](../../SPEC.md), which stays the source of truth for everything
else. Asked for by the author on 2026-11-12, from a screenshot of a build page.

## Objective

- **What:** text in a hairline row no longer starts or ends exactly where the hairline does.
  Every row's content is inset **12px** (`px-3`) from both ends of its lines.
- **Why:** with the text flush to the line ends, the rows look cramped and unfinished (the
  checklist's "Add" links and the Summary's amounts end exactly where the hairlines end).
  The builds list table already does it right: its first and last cells are padded 12px
  (`edgeCells`, `pages/BuildsList.tsx`). The rest of the app should match it.
- **Users:** everyone; most visible on a build page at desktop width.

### Where (every row list that's flush today)

| Rows | File | Today |
|---|---|---|
| Build checklist rows (icon, slot, part, "Add") | `components/BuildChecklist.tsx` | flush |
| Summary: the Profit block and the amounts below it | `components/Summary.tsx` | flush |
| Parts: the column heads, part rows, bundle rows, the Total row | `components/PartsTable.tsx`, `PartRow.tsx`, `BundleRow.tsx` | flush |
| Extra costs rows | `components/ExtraCosts.tsx` | flush |
| "Find prices" results | `components/PriceLookup.tsx` | flush |
| Builds list on phones (the cards) and its loading rows | `pages/BuildsList.tsx` | flush below 640px |

Already right, unchanged: the builds list table (desktop), the part search pop-up (`px-3`),
the header, the demo banner and the footer (page padding).

### What stays flush

- **Section headings and their top lines** ("Build", "Parts", "Summary", "Extra costs",
  "Notes", the Account and Privacy sections), the Build progress bar, and buttons beside a
  heading ("Add part", "Add bundle"). They sit on the page's own edge, as the builds list's
  heading and "New build" button do today.
- **The builds summary's stat strip** on the builds list: each figure sits under its own top
  line like a small heading, not in a row.
- **Inline edit boxes** (a part, bundle or cost being edited, on `sunken`) keep the full row
  width. Their own 12px padding already puts their contents on the new inset.

## Tech Stack

React 19, TypeScript, Tailwind v4. Class changes only: no new component, dependency or token.

## Commands

Same as [SPEC.md](../../SPEC.md#commands): in `frontend/`, `npm test`, `npm run lint`,
`npx tsc -b`, `npx prettier --check src`, `npx playwright test`.

## Project Structure

```
frontend/src/components/BuildChecklist.tsx  checklist rows
frontend/src/components/Summary.tsx         Profit block and amounts
frontend/src/components/PartsTable.tsx      column heads and Total row
frontend/src/components/PartRow.tsx         part rows (view mode)
frontend/src/components/BundleRow.tsx       bundle rows (view mode)
frontend/src/components/ExtraCosts.tsx      cost rows
frontend/src/components/PriceLookup.tsx     price results
frontend/src/pages/BuildsList.tsx           phone cards and loading rows
docs/brand-guidelines.md                    the rule, so new rows follow it
```

## Code Style

The inset goes on the row, so text, columns and the row's hairline stay one unit:

```tsx
<li className="flex items-center gap-3 border-b border-line px-3 py-2">
```

A `<table>` can't pad its `<tr>`, so the builds list keeps `edgeCells` on its first and last
cells. No shared constant for `px-3`: it's one Tailwind class, and the brand rule names it.

## Testing Strategy

- **No new tests.** It's spacing: jsdom can't lay out a page, and a test that only checks a
  class name would test the implementation, not the look. The existing frontend and e2e
  tests must still pass, unchanged.
- **Screenshots, before and after:** a build page with parts, a bundle, an extra cost and a
  selling price; a part being edited with prices found; the builds list. At 1280px and
  375px, light and dark.
- **Watch at 375px and 320px:** part names and amounts still fit, the builds list cards'
  three figures don't wrap, and no page scrolls sideways (Checkpoint 9 asked for 320px).

## Boundaries

- **Always:** 12px, the same on both ends of a row; columns in the Parts heads, rows and
  Total stay lined up; keep the edit boxes full width.
- **Ask first:** a different inset on phones; insetting headings, buttons or the stat strip;
  any change beyond horizontal padding (row heights, line colours).
- **Never:** cards, shadows or rounded rows (the brand's hairlines stay); a new dependency.

## Success Criteria

1. On a build page at 1280px, no row text in the checklist, Summary, Parts, Extra costs or
   price results touches either end of its hairlines: there's a 12px gap on both sides.
2. The same holds at 375px, including the builds list cards.
3. Section headings, the progress bar and the heading buttons haven't moved.
4. The Parts column heads, rows and Total row still line up.
5. An open edit box still spans the row's full width.
6. `docs/brand-guidelines.md` states the rule: rows inset 12px; headings flush.
7. All tests pass (frontend, e2e).

## Open Questions

None. Decided 2026-11-12: phones too (the builds list's loading rows go from `sm:px-3` to
`px-3`), and 12px everywhere, one rule (the author left the size to Claude).
