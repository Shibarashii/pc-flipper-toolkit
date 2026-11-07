# CLAUDE.md

How to work on PC Flipper Toolkit. The product itself is described in [SPEC.md](SPEC.md),
which also has the commands (setup, tests, lint) and the project structure.

## Where things are

- [SPEC.md](SPEC.md): the source of truth for the app as a whole.
- [docs/specs/](docs/specs/): one spec per later feature, linking back to SPEC.md. New specs
  go here (`docs/specs/<feature>.md`), never as `SPEC-<x>.md` at the root.
- [docs/intent/](docs/intent/): confirmed statements of intent from interviews.
- [docs/ideas/backlog.md](docs/ideas/backlog.md): rough ideas and parked decisions. An idea
  that gets a spec moves out of the list ("Moved to …").
- [tasks/plan.md](tasks/plan.md) and [tasks/todo.md](tasks/todo.md): every phase so far,
  with acceptance criteria and checkpoints. A new feature adds a phase at the end. Never
  overwrite them.
- [docs/brand-guidelines.md](docs/brand-guidelines.md): the look (warm paper and ink, green
  accent, hairlines rather than cards).

## How a feature goes

1. **Interview** (`interview-me`) when the idea is rough, until the user confirms the intent.
2. **Spec** (`/agent-skills:spec`) in `docs/specs/<feature>.md`; the user approves it.
3. **Plan** (`/agent-skills:plan`): a new phase in `tasks/plan.md` and `tasks/todo.md`.
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
  their UUID `public_id`. Never expose the integer ids ([spec](docs/specs/public-ids.md)).
- **Migrations** must be safe while the old code still runs: Render migrates before the new
  code serves, so a new column needs a database default (`db_default`).
- **Shop prices:** only each shop's `/products.json`, with an honest user agent, 1 second
  apart, at most once a day per shop. Never a browser user agent, never around a block or a
  bot check. Don't start extra workflow runs or local refreshes just to check something.

## Running things locally

- The user may already have Django's `runserver` on port 8000 serving the working tree. Reuse
  it; don't kill it.
- On the author's desktop, port 5173 belongs to another project. Run a second Vite server
  on **5199** (`npm run dev -- --port 5199 --strictPort`) and stop it afterwards by its pid
  (`ss -ltnp | grep ':5199'`).
- For e2e against 5199, use a temporary `frontend/.pw-local.config.ts` (base URL 5199,
  reusing the server on 8000) and delete it afterwards.
- Sign-up, log-in and "Try the demo" share a limit of 10 a minute, so many e2e runs or demos
  in a row can fail with 429.
- In zsh, don't name a variable `path`: it's tied to `PATH`.

## Deploys

- Merging to `main` deploys the frontend to Vercel (https://pc-flipper-toolkit.vercel.app)
  and the API to Render (https://pc-flipper-toolkit.onrender.com), which runs `migrate`.
- Vercel's production deploy sometimes fails instantly although the preview passed. Check
  `gh api repos/Shibarashii/pc-flipper-toolkit/commits/<sha>/status`; the user redeploys
  from the dashboard.
