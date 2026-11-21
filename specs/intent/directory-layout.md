# Intent: one `specs/` folder for building the app; `docs/` only for its users

Confirmed by the author on 2026-11-21 (interview-me, after looking at what Spec Kit, Kiro and
Claude Code do: `.claude/` is Claude Code's configuration, not documents; Spec Kit keeps a
visible top-level `specs/`).

- **Outcome:** a visible top-level `specs/` holds everything for building the app: `app.md`
  (was `SPEC.md`), one spec per feature, `intent/`, `ideas/` (with the backlog), `plan.md`
  and `todo.md` (were in `tasks/`), and `design/brand.md` and `design/figma.md` (were in
  `docs/`). `docs/` goes until there's documentation for the app's users.
- **User:** the author, Claude, and anyone browsing the repo.
- **Why now:** `docs/` and `tasks/` held Claude's working files, but "docs" should mean
  documentation for the app's users, not for developers or agents.
- **Success:** no `docs/`, `tasks/` or `SPEC.md` left; every link and path (between the
  files, CLAUDE.md, README, code comments) points to the new place; the agent-skills commands
  find the plan and todo in `specs/`; each file keeps its git history.
- **Constraint:** files are moved, not reworded; one PR; links in merged PRs and old commits
  point to old paths, which is accepted.
- **Out of scope:** user documentation; Spec Kit's numbered folders per feature; changing what
  the specs say; the Figma file; `.claude/`, which stays Claude Code's configuration.
