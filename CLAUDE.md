# CLAUDE.md

How to work on PC Flipper Toolkit. The product itself is described in [specs/app.md](specs/app.md),
which also has the commands (setup, tests, lint) and the project structure.

## Where things are

Everything written for building the app, by the author or by an agent, lives in
[specs/](specs/): specs, plans, intent, ideas and design notes. [docs/](docs/) is for anyone
reading or using the project: getting started, testing, deployment, and the README's
screenshots in `docs/images/` (taken by `frontend/scripts/readme-screenshots.mjs`). Nothing
for agents goes there.
`.claude/` is Claude Code's configuration (settings, skills, agents), not documents. Never put
a spec or plan at the root, in `docs/` or in `tasks/`, even when a skill's default says so:
the paths below override the agent-skills defaults (`SPEC.md`, `tasks/plan.md`,
`tasks/todo.md`, `docs/intent/`). Why: [specs/intent/directory-layout.md](specs/intent/directory-layout.md).

| What | Where | Notes |
|---|---|---|
| The app as a whole | [specs/app.md](specs/app.md) | The source of truth; what agent-skills calls `SPEC.md` |
| A feature's spec | `specs/<feature>.md` | One file, kebab-case, linking back to `app.md`. Never `SPEC-<x>.md` |
| Plan and task list | [specs/plan.md](specs/plan.md), [specs/todo.md](specs/todo.md) | See below |
| A confirmed intent | `specs/intent/<topic>.md` | From `interview-me`, saved once the user says yes |
| Rough ideas | [specs/ideas/backlog.md](specs/ideas/backlog.md), `specs/ideas/<idea>.md` | An idea that gets a spec moves out of the list ("Moved to …") |
| The look | [specs/design/brand.md](specs/design/brand.md) | Warm paper and ink, green accent, hairlines rather than cards |
| The Figma file | [specs/design/figma.md](specs/design/figma.md) | Its pages and components, and how to build a screen in it. Read it before any Figma work |

`specs/plan.md` and `specs/todo.md` hold every phase so far, with acceptance criteria and
checkpoints. A new feature adds a phase at the end. Never overwrite them. They're long and the
old phases are done: read only the last phase (find it with
`grep -n '^#* Phase' specs/plan.md specs/todo.md`) and any unticked `- [ ]`.

Code comments point to the spec they implement by path, like `(specs/public-ids.md)`.

## Designing in Figma

- Read [specs/design/figma.md](specs/design/figma.md) first; it has the ids of every page and component.
- New designs go on **Flow — in review**, linked to their spec. They move to **Ready for
  development** only after the user approves the spec; code is built from that page.
- Use the existing components (Header, Footer, Button, Field, rows, cards…) as instances, the
  `Brand v2` variables and the `editorial/*` text styles. Never hard-code a color, detach an
  instance or redraw a component.
- Every screen comes in light and dark (the dark one is the light one with the `Dark` mode),
  desktop 1280 and mobile 375, named `<Screen> · <State> — <Desktop|Mobile> · <Light|Dark>`.
- Copy sizes from the code (`App.tsx`, the page, `ui.ts`) and words from the spec. Where Figma
  and the code disagree on spacing, the code wins.

## How a feature goes

1. **Interview** (`interview-me`) when the idea is rough, until the user confirms the intent.
2. **Spec** (`/agent-skills:spec`) in `specs/<feature>.md`; the user approves it.
3. **Plan** (`/agent-skills:plan`): a new phase in `specs/plan.md` and `specs/todo.md`.
4. **Build** (`/agent-skills:build`): one task at a time, test first, then stop.
5. **Review** (`/agent-skills:review`), fix what the user agrees to, then open the PR.
6. **Merge** only when the user says "merge" (steps below).
7. **Checkpoint:** check the feature on the live site after the deploy, then tick it in a
   small `chore(tasks)` PR.

A bare `/agent-skills:test` right after a build means "check the tests of what was just
built", never "start the next task". Never pick up the next task from a test or review
command.

## Git and pull requests

- Never push or commit to `main`. One branch per task (`feat/…`, `fix/…`, `docs/…`,
  `chore/…`), pushed, then `gh pr create`.
- Conventional commits for every commit and PR title: `type(scope): summary`, lower case,
  imperative. Scopes are feature areas (`builds`, `parts`, `listing`, `condition`, `ids`,
  `demo`, `tasks`…). Ticking a task or checkpoint is `chore(tasks): …`.
- Commit messages end with a `Co-Authored-By:` line; PR bodies end with the Claude Code line.
- Required checks: `backend`, `frontend` and `e2e`. The repo squash-merges only and deletes
  merged branches.
- **On "merge":**
  1. `gh pr checks <n> --watch --required`, and make sure the PR's head SHA is the local one.
  2. `gh pr merge <n> --squash --subject "<PR title> (#<n>)" --body "<body>"`, where the body
     is `Commits:`, one `- <subject>` line per branch commit
     (`git log --reverse --format='- %s' origin/main..<branch>`), a blank line, then the
     `Co-Authored-By:` line.
  3. `git switch main && git pull --ff-only`, then delete the local branch (GitHub has
     already deleted the remote one).

## Rules

- **Never** commit secrets or `.env` files. `backend/.env` stays local. When checking it,
  print only the hostname, never a password.
- **Never** paste or commit the Neon (production database) connection string. Use it only
  inline for a one-off command, `env DATABASE_URL='…' .venv/bin/python manage.py <cmd>`,
  then remove it from the shell history (`history delete --contains neon.tech` in fish).
- **Money** is `Decimal` in Python and a string in JSON (`"12500.00"`), never a float.
- **Don't** remove or skip a failing test; fix the cause.
- **Ask first** before adding a dependency, changing the data model of something already
  shipped, changing where it deploys, or adding anything outside the agreed scope.
- **Ids:** builds, parts, bundles and extra costs are named outside the database only by
  their UUID `public_id`. Never expose the integer ids ([spec](specs/public-ids.md)).
- **Migrations** must be safe while the old code still runs: Render migrates before the new
  code serves, so a new column needs a database default (`db_default`).
- **Shop prices:** only each shop's `/products.json`, with an honest user agent, 1 second
  apart, at most once a day per shop. Never a browser user agent, never around a block or a
  bot check. Don't start extra workflow runs or local refreshes just to check something.

## Running things locally

- The user may already have Django's `runserver` on port 8000 serving the working tree. Reuse
  it; don't kill it.
- Check what's on port 5173 before starting Vite (`ss -ltnp | grep ':5173'`, then
  `readlink /proc/<pid>/cwd`). If it's this project's `frontend/`, use it. If another project
  holds it, run a second Vite server on **5199** (`npm run dev -- --port 5199 --strictPort`),
  stop it afterwards by its pid, and for e2e use a temporary `frontend/.pw-local.config.ts`
  (base URL 5199, reusing the server on 8000), deleted afterwards.
- A local `frontend/.env` may hold real values (like `VITE_GOOGLE_CLIENT_ID`); tests must not
  depend on it.
- Sign-up, log-in and "Try the demo" share a limit of 10 a minute, so many e2e runs or demos
  in a row can fail with 429.
- In zsh, don't name a variable `path`: it's tied to `PATH`.

## Deploys

- Merging to `main` deploys the frontend to Vercel (https://pc-flipper-toolkit.vercel.app)
  and the API to Render (https://pc-flipper-toolkit.onrender.com), which runs `migrate`.
- Vercel's production deploy sometimes fails instantly although the preview passed. Check
  `gh api repos/Shibarashii/pc-flipper-toolkit/commits/<sha>/status`; the user redeploys
  from the dashboard.
