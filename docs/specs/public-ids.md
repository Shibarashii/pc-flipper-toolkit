# Spec: Public ids

A change to how the API and the app's URLs name records, on top of [SPEC.md](../../SPEC.md),
which stays the source of truth for everything else. Agreed in conversation on 2026-11-07.

## Objective

Every user-owned record (build, part, bundle, extra cost) is named outside the database by a
random UUID instead of its sequential integer id: `/builds/3f2c9a4e-…` instead of `/builds/123`.

- **Why:** the integer ids count every user's records, so they show how big the site is and
  how fast it grows, and they invite guessing. Access is already protected: every query is
  filtered by owner and another user's id returns 404 (SPEC.md). Public UUIDs are the extra
  layer that keeps the database's internals out of URLs and API responses, the way production
  APIs do it (OWASP: unguessable ids as defence in depth, never instead of access checks).
- **User:** anyone using the app, who never sees a difference except the address bar. And
  anyone reading the code or the API docs.

### The rule

- **Inside the database, nothing changes.** The integer primary keys and foreign keys stay.
  They're compact and fast for joins, and the build's `number` (Build 01, 02…) relies on ids
  only growing.
- **Outside, only the UUID.** Each of the four models gets a `public_id`. The API calls it
  `id`, uses it in every path (`/api/parts/{id}/`) and in every reference (`build` and
  `bundle` in a part, `build` in a bundle or extra cost). No integer id of these four models
  appears in any response, request or URL.
- **UUID version 4 (random).** It isn't the primary key, so it doesn't need to be time-ordered
  (version 7), and a random one reveals nothing, not even when the record was made. Plain
  UUIDs, without Stripe-style prefixes like `bld_`.
- **Old links:** an integer URL like `/builds/123` shows the existing "Build not found" page.
  The API answers an integer (or any non-UUID) id with 404, the same as a missing one. No
  redirects (decided 2026-11-07).

### User stories

1. A new build opens at `/builds/<uuid>`; links, back/forward, reload and the login redirect
   (`from`) all work as before.
2. Adding, editing and deleting parts, bundles and extra costs work as before.
3. `/builds/123` and `/api/builds/123/` give not found.
4. Another user's UUID gives 404, as another user's integer id did.
5. Existing builds on the live site keep working after the deploy, each with its own UUID.

### Out of scope

- Changing the primary keys to UUIDs, or touching the shop catalogue (`ShopProduct`, whose ids
  aren't exposed).
- Prefixed ids (`bld_…`), short ids (Sqids, nanoid), or redirects from old URLs.
- User ids: users are only ever named by username, and tokens are already random.

## Data model

Each of `Build`, `Part`, `Bundle` and `ExtraCost` gets:

```python
public_id = models.UUIDField(unique=True, editable=False, db_default=RandomUUID())
```

- `RandomUUID()` is Postgres' `gen_random_uuid()` (from `django.contrib.postgres`), a version 4
  UUID. As the column's database default, it fills every existing row with its own UUID while
  the migration runs, in one step, instead of Django's three-step recipe (add nullable, fill,
  make unique).
- It also covers the deploy: Render runs `migrate` while the old code is still serving, and an
  old-code insert, which doesn't know the column, gets a UUID from the database instead of
  failing.
- `unique=True` gives it an index, so lookups by it are as fast as by id.

## API

| Before | After |
|---|---|
| `"id": 12` | `"id": "3f2c9a4e-0b6d-4c1e-9a57-2d8f6e1b4c90"` |
| `"build": 3`, `"bundle": 7` | `"build": "<build uuid>"`, `"bundle": "<bundle uuid>"` or `null` |
| `/api/builds/{id}/` with an integer | the same path with the UUID |

- Serializers: `id` reads `public_id`; `build` and `bundle` are slug fields on `public_id`,
  with the owner-filtered querysets they have now, so another user's UUID is "object does not
  exist", as today.
- Viewsets: `lookup_field = "public_id"`, `lookup_url_kwarg = "id"`, so the API docs still say
  `{id}`. A non-UUID id is a 404 (DRF's lookup already turns a bad value into not found).
- The builds summary, `number`, totals and price search don't change.
- API docs: examples use UUIDs; the paths and field descriptions say UUID.

## Frontend

- Ids are strings in `api.ts` (`id`, `build`, `bundle`), the routes and the fixtures.
- `BuildDetail` drops its "positive integer" check: any id goes to the API, and a 404 shows
  "Build not found".
- This ships first, on its own: it works with today's integer API, so the frontend is ready
  before the API changes.
  - It mustn't check for UUID format either: Vercel deploys the new frontend a few minutes
    before Render deploys the new API, and in between the API still sends integers.
  - A tab left open from before the deploy treats a UUID as "not a number" and shows not
    found until reloaded. Accepted.

## Commands

Same as [SPEC.md](../../SPEC.md#commands): `python manage.py test`,
`python manage.py makemigrations --check`, `ruff check . && ruff format .` and
`python manage.py spectacular --validate --fail-on-warn` in `backend/`; `npm test`,
`npm run lint`, `npx tsc -b` and `npx playwright test` in `frontend/`.

## Project Structure

```
backend/builds/
  models.py            + public_id on Build, Part, Bundle, ExtraCost
  migrations/0007_…    adds the four columns with gen_random_uuid()
  serializers.py       id from public_id; build/bundle by public_id; UUID examples
  views.py             lookup by public_id
  tests.py             paths and bodies use public ids; + the tests below
frontend/src/
  api.ts               string ids
  pages/BuildDetail.tsx  no integer check
  test/fixtures.ts, *.test.tsx   string ids
SPEC.md                API table and data model say UUID
```

## Testing Strategy

- **Backend:**
  - Every response's `id`, `build` and `bundle` is a UUID, never an integer, for all four
    resources (list, detail, create, update).
  - An integer id and a malformed id give 404 on every detail path.
  - Another user's UUID gives 404 (detail) or "object does not exist" (`build`/`bundle` in a
    body), for all four, as the existing ownership tests do with integers.
  - The migration: rows that existed before it each get a different UUID (a migration test,
    or a check on the migrated test data).
  - An insert that doesn't set `public_id` (like the old code during a deploy) gets one from
    the database.
  - The query count for the list and detail stays the same.
- **Frontend:** the existing tests with string ids; `/builds/123` shows not found after the
  API's 404.
- **E2E:** the flip spec checks a new build's address: it requires a UUID instead of digits.
  The rest follow links rather than build URLs.
- **Live:** after the deploy, an existing build opens at its UUID URL, and its old integer URL
  shows not found.

## Boundaries

- **Always:** keep the integer keys inside the database; keep every owner check; use the
  UUID everywhere outside.
- **Ask first:** changing primary keys, adding prefixes or redirects, touching user or shop
  ids.
- **Never:** return an integer id of these four models in any response; rely on UUIDs instead
  of owner checks.

## Success Criteria

1. No API response, request body or app URL contains an integer id of a build, part, bundle or
   extra cost (backend tests check every resource).
2. Integer and malformed ids give 404; another user's UUID gives 404, for all four.
3. After the deploy, every existing build on the live site opens at its own UUID URL, and
   nothing failed during the deploy.
4. All tests pass, and the API docs validate and show UUIDs.

## Open Questions

None. Decided 2026-11-07: all four models, and old integer links show not found.
