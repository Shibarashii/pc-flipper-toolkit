# Spec: Builds summary

A separate feature on top of [SPEC.md](../../SPEC.md), which stays the source of truth for
everything else (stack, auth, money rules, code style). Agreed in conversation on 2026-11-06
(see [the backlog](../ideas/backlog.md)).

## Objective

When I open the app, one line above my builds tells me how I'm doing: **this month's profit**,
**all-time profit**, and **how much money is tied up** in builds I haven't sold yet. I don't
have to add anything up myself.

- **User:** a flipper opening the builds list. Demo accounts get it too, and it's the first
  thing a demo viewer sees.
- **Why:** the app stores every build's cost, profit and sold date, but only shows them one
  build at a time. A flipper's cash is stuck in unsold PCs, and that's what stops them
  buying the next deal.

```
This month             All time               Tied up
₱8,400.00              ₱41,200.00             ₱23,500.00
2 sold                 9 sold                 in 3 builds
```

### The numbers

| Figure | Counts | Rule |
|---|---|---|
| **This month:** profit and "N sold" | Builds with status Sold whose sold date is in the current calendar month, in Philippine time (`Asia/Manila`) | Profit adds up those builds' `profit`. A sold build with no selling price adds nothing, but still counts in "N sold". |
| **All time:** profit and "N sold" | Every build with status Sold, with or without a sold date | Same as above. A sold build with no sold date counts here, but not in This month. |
| **Tied up:** cost and "in N builds" | Builds not sold (Planning, Building, Listed) whose `total_cost` is above ₱0 | Adds up their `total_cost`. An empty Planning build isn't counted. |

- `profit` and `total_cost` are the same values the builds list already shows (`totals` in
  SPEC.md), so bundles count once and extra costs are included.
- Profit can be negative (a loss). It's shown with a sign and in the loss colour, like the
  builds list's Profit column.
- There's no new rule about Sold. Picking Sold already fills in today's date, and a selling
  price can be added any time (decided 2026-11-06).

### User stories

1. With sold and unsold builds, I see the three figures above the list, matching what I'd get
   by adding up the list by hand.
2. On the 1st of a month, This month starts again at ₱0.00 and 0 sold. All time keeps
   counting.
3. A loss month shows a negative profit in the loss colour.
4. With no builds at all, there's no summary: the empty state ("No builds yet") stays as it is.
5. On a phone (375px), the three figures fit without horizontal scrolling.

### Out of scope (this version)

- The stats screen: profit per month as a chart, a month picker (step 2 in the backlog).
- Days to sell, filtering by status or date, choosing which figures to show.
- A hint about sold builds without a price.
- Any change to the data model or to the rules for Sold.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/builds/summary/` | The three figures for the logged-in user's builds |

```json
{
  "this_month": {"profit": "8400.00", "sold": 2},
  "all_time": {"profit": "41200.00", "sold": 9},
  "tied_up": {"cost": "23500.00", "builds": 3}
}
```

- Money is a Decimal string, like every amount in the API. Counts are integers.
- Only the user's own builds count. It needs a token like every endpoint (401 without).
- It's a `@action(detail=False)` on the builds viewset, so it reuses its owner filter and
  prefetching. The query count stays the same however many builds there are.
- The figures are worked out in Python from the model's `profit` and `total_cost`, so the
  bundle and extra-cost rules live in one place.
  `ponytail:` it reads every build, which is fine for a flipper's few hundred. Move it to a
  database aggregate if that ever gets slow.
- Documented in drf-spectacular like the rest (summary, description, example).

## Screens

**Builds list** (`frontend/src/pages/BuildsList.tsx`). The summary sits between the header
("Builds", the count line and New build) and the table:

- Three labelled figures. Each has a small label ("This month", "All time", "Tied up"), the
  amount in serif tabular figures, and a small muted line under it ("2 sold", "in 3 builds").
- On desktop they share a row. On phones, **This month** is the headline: full width and
  larger (30px) than anything in the build cards, with All time and Tied up side by side
  under it (20px). Three equal 15px columns read like another build (changed 2026-11-06).
- It's set off with the hairline borders the page already uses, with no card or shadow, and
  no accent colour (that's for the primary action). Profit uses the same sign and colour
  helpers as the table (`formatSignedMoney`, `profitColor`), so a profit looks the same in
  both.
- It loads at the same time as the list. While loading, a placeholder line of the same height
  keeps the table from jumping. If the summary fails to load, it's left out and the list
  works as usual. The list has its own error message.
- At 375px, the three columns may wrap their amounts but never scroll sideways.

**Demo:** the sample sold build is dated **today** instead of 3 days ago
(`backend/builds/demo.py`). Otherwise, on the 1st to 3rd of a month, a demo would open
showing This month: ₱0.00.

## Commands

Same as [SPEC.md](../../SPEC.md#commands): `python manage.py test` and
`ruff check . && ruff format .` in `backend/`; `npm test`, `npm run lint` and
`npx tsc -b` in `frontend/`.

## Project Structure

```
backend/builds/
  views.py           + BuildViewSet.summary (the @action)
  serializers.py     + BuildsSummarySerializer (shape and schema)
  demo.py            the sold sample build is dated today
  tests.py           + summary tests
frontend/src/
  api.ts             + getBuildsSummary(), BuildsSummary type
  components/BuildsSummary.tsx   the summary line (Summary.tsx is the build page's totals)
  components/BuildsSummary.test.tsx
  pages/BuildsList.tsx           loads and shows it
```

## Testing Strategy

- **Backend (`builds/tests.py`):**
  - Each figure on a mix of builds: sold this month, sold last month, sold with no date,
    sold with no price, a loss, Listed and Building builds with costs, and an empty Planning
    build.
  - The month boundary in Manila time: with the date mocked, a build sold on the last day of
    last month isn't counted in This month, and one sold on the 1st is.
  - Bundles count once and extra costs are included (the same `total_cost` as `totals`).
  - Another user's builds never count. 401 without a token. The query count doesn't grow
    with the number of builds.
  - A new demo's summary counts its sold build in This month.
- **Frontend (Vitest):** the three figures and their small lines from a fixture; a negative
  profit in the loss colour with a sign; "1 sold" / "1 build" singular; no summary when
  there are no builds; a failed summary request leaves the list working.
- **Manual:** the live demo at desktop width and at 375px.

## Boundaries

- **Always:** keep money as Decimal on the server and as strings in the API; work every figure
  out on the server; count only the user's own builds.
- **Ask first:** any data model change; changing the rules for Sold; adding figures or a
  new screen; any new dependency.
- **Never:** do money math in the browser; show costs or profit from another account.

## Success Criteria

1. On the live demo, This month shows the sold sample build's profit and "1 sold", and Tied
   up shows the in-progress build's total cost "in 1 build". Both match that build's page to
   the centavo.
2. Backend tests prove every rule in [The numbers](#the-numbers), including the Manila month
   boundary, and all tests pass.
3. The builds list with the summary is usable at 375px without horizontal scrolling.
4. A failed summary request doesn't break the builds list.

## Open Questions

None. Resolved: Tied up counts only unsold builds with money in them (total cost above ₱0),
confirmed 2026-11-06.
