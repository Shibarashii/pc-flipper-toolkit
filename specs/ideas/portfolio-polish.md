# Portfolio polish

## Problem Statement

How might we make every control and line say plainly what it does, both for someone clicking
through the demo for two minutes and for a flipper using it every week, without adding clutter?

## Recommended Direction

**Icons for the build's own actions.** "Copy listing" and "Delete build" become icon buttons
through the existing `IconButton` ([form.tsx](../../frontend/src/components/form.tsx)), which
already gives an `aria-label` and a native `title` tooltip. Delete reuses `trash.svg`. Copy
listing gets a new "document" icon, not a two-squares copy icon: the button opens a dialog where
the listing can be edited before copying, and a copy icon would promise an instant copy.

**Tooltips only where something is hidden; plain words everywhere else.** A `title` tooltip
never shows on touch or keyboard focus, so it can name an icon or reveal cut-off text, but it
can't carry meaning nobody else will see. So: icon-only controls and truncated text get one,
and the summary labels that need explaining get clearer words instead.

**Regroup the Account page by what you do.** Today it mixes "log in" and "sign in", tells you
how you sign in in two sections (Password and Google), explains "keep one way in" only under
Google, repeats the username under "Logged in as", and tells a Google-only account to add an
email "if you forget your password". The page becomes three sections: Username, **Ways to sign
in** (password and Google in one list, with "Keep at least one way to sign in" said once), and
**Recovery email**. One verb throughout: "sign in".

## Key Assumptions to Validate

- [ ] The two icons are recognisable without their words: show the build page to someone new
      and ask what each does before they hover.
- [ ] The renamed summary labels need no tooltip: read them aloud to a flipper.
- [ ] "Ways to sign in" is clearer than separate Password and Google sections: walk through
      "change my password" and "stop using Google" on the Figma screens.

## MVP Scope

In: the two icon buttons; tooltips on icon-only controls, the truncated username in the
header and the checklist marks; renamed summary labels; the regrouped Account page with
rewritten copy (including the demo note). Out: everything below.

## Not Doing (and Why)

- **A brand-styled tooltip component**: it only pays off if tooltips carry real information,
  and this direction keeps information in visible words.
- **Copy at once, without the dialog**: the dialog lets you edit the post before copying,
  which the copy-listing spec asked for.
- **Setting a password on a Google-only account**: a new feature, not wording. Park it.
- **A label | value | action settings grid**: more layout for the same clarity, and tight at
  375px.

## Open Questions

- The summary renames (in the spec) are proposals; the author picks the words.
