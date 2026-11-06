# Spec: CI speedups

A small change to [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), on top of
[SPEC.md](../../SPEC.md). Agreed in conversation on 2026-11-06.

## Objective

CI stays as it is: the same three jobs on every pull request and on `main` after a merge. It
should waste less time:

1. **Cache Playwright's Chromium.** The e2e job downloads Chromium on every run. On
   2026-11-06, `playwright install --with-deps chromium` took about 10 minutes twice, while a
   normal run takes about 2 minutes in total.
2. **Cancel a PR's superseded run.** When a new commit is pushed to a PR, its older run keeps
   going for nothing (PR #49's two pushes at 13:44 and 13:45 ran side by side).
3. **Time limits.** A stuck step currently waits for GitHub's 6-hour default. It should fail
   fast so it can be rerun.

- **User:** the author, waiting on CI to merge, and Render, which deploys `main` only after its
  checks pass.
- **Why both runs stay:** a PR's run tests it with `main` as it was then. Branches don't have
  to be up to date before merging, so the run on `main` tests the squashed commit that ships.
  Render's Auto-Deploy waits for that run.

### Out of scope

- Skipping CI for docs-only changes, or running jobs based on which paths changed. The three
  checks are required, so a skipped run never reports and the PR can't merge.
- Requiring PRs to be up to date before merging, a merge queue, or the Playwright Docker
  image.
- Caching the apt packages behind `--with-deps`. They still install on every run, so a slow
  apt mirror can still slow the job.
- Any change to the jobs' steps, tests, or names.

## The changes

**1. Chromium cache (e2e job).** After `npm ci`, read the installed Playwright version and
cache `~/.cache/ms-playwright` under it:

```yaml
- id: playwright
  run: echo "version=$(node -p "require('@playwright/test/package.json').version")" >> "$GITHUB_OUTPUT"
  working-directory: frontend
- uses: actions/cache@v6
  id: browsers
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ runner.os }}-${{ steps.playwright.outputs.version }}
- if: steps.browsers.outputs.cache-hit != 'true'
  run: npx playwright install --with-deps chromium
  working-directory: frontend
- if: steps.browsers.outputs.cache-hit == 'true'
  run: npx playwright install-deps chromium   # only the system packages
  working-directory: frontend
```

- Keyed by the exact Playwright version, so upgrading Playwright downloads the matching
  Chromium once.
- GitHub shares a cache saved on `main` with every PR. A PR's own cache is only shared with
  later runs of that PR.

**2. Cancelling superseded PR runs (whole workflow).**

```yaml
concurrency:
  # One run per PR: a new push cancels the older one. Runs on main are never grouped, so
  # every merged commit gets its own run and Render can deploy it.
  group: ${{ github.event_name == 'pull_request' && format('ci-{0}', github.ref) || format('ci-run-{0}', github.run_id) }}
  cancel-in-progress: true
```

A shared group on `main` would let a newer merge replace a waiting run, so that commit would
never get checks. Each `main` run gets its own group (its run id) instead.

**3. Time limits (each job).** `timeout-minutes`: backend 10, frontend 10, e2e 20. Today's
runs: backend about 50 s, frontend about 1 min, e2e 2 min normally and 11 min at worst.

## Commands

No new commands. CI runs as before on `pull_request` and on `push` to `main`.

## Project Structure

```
.github/workflows/ci.yml     the three changes above
```

## Testing Strategy

A workflow can't be unit tested, so each change is checked on real runs. No runs are started
just to test this:

- **Cache:** this PR's run logs a cache miss and installs Chromium. After the merge, `main`'s
  run saves the cache. The next PR's e2e log shows a cache hit and runs only `install-deps`.
- **Cancelling:** the next time a PR gets a second push while its run is going, the older run
  shows as cancelled, and the PR's checks come from the newer run.
- **`main` isn't cancelled:** every merge commit on `main` keeps its own run.
- **Time limits:** `gh run view` shows them on the jobs; nothing needs to time out to prove
  it.
- The workflow file passes GitHub's own validation (a malformed file shows as a failed run
  at once).

## Boundaries

- **Always:** keep the three job names (`backend`, `frontend`, `e2e`), because branch
  protection requires them by name; keep every `main` run.
- **Ask first:** changing which events run CI, branch protection, Render's deploy setting, or
  adding a new action beyond `actions/cache`.
- **Never:** skip or weaken a test or check to make CI faster; cancel runs on `main`.

## Success Criteria

1. This PR's three checks pass, with the same names.
2. After the merge, the first PR whose e2e job runs logs a Chromium cache hit and skips the
   browser download.
3. A PR that gets a second push while its run is going ends up with one finished run: the
   newest.
4. Every merge on `main` still gets its own run, and Render still deploys after it passes.

## Open Questions

None.
