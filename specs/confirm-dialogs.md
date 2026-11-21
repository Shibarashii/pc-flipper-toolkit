# Spec: Ask before every action that can't be taken back

Four one-click actions ask first, in the same dialog that already asks before deleting a
build or a bundle. On top of [specs/app.md](app.md), which stays the source of truth.
Approved 2026-11-21 as written.

## Objective

- **What:** deleting a part, deleting an extra cost, Disconnect Google and Exit demo each open a
  dialog with Cancel and the action. Nothing happens until the action is clicked.
- **Why:** today one stray click deletes a part or a cost for good, disconnects Google, or ends
  a demo whose builds can't be opened again. Deleting a build and a bundle already asks; the
  rest should too.
- **Users:** everyone editing a build; Account's Google row; anyone trying the demo.

### User stories

1. I tap a part's trash icon by mistake: a dialog asks "Delete this part?", and Cancel (or Esc)
   leaves the part as it was.
2. Same for an extra cost.
3. On Account, Disconnect asks first and says how I'll log in afterwards.
4. In the demo, Exit demo asks first and says the builds can't be opened again.

### Out of scope

- Undo instead of a dialog. A dialog is what the app already does; undo needs the delete to wait
  or be reversible on the server.
- The demo banner's "Sign up for your own account" link: its words say what it does, and the
  banner beside it says the demo is deleted after 24 hours. It stays one click.
- Log out (nothing is lost), saving edits, Change password (it asks for the current one).

## The dialogs

The look and behavior of today's delete dialog
([DeleteDialog.tsx](../frontend/src/components/DeleteDialog.tsx)): a title, a muted message,
Cancel first (so Esc and Enter never act by accident), the action in red on the right. While the
request runs, the action reads "…ing" and is disabled; if it fails, the dialog stays open with
the error under the message.

| Action | Title | Message | Button (while running) | Error |
|---|---|---|---|---|
| A part's trash icon | Delete this part? | “RTX 3060” will be deleted. This can’t be undone. | Delete part (Deleting…) | Couldn’t delete the part. Check your connection and try again. |
| An extra cost's trash icon | Delete this extra cost? | “Shipping” will be deleted. This can’t be undone. | Delete extra cost (Deleting…) | Couldn’t delete the extra cost. Check your connection and try again. |
| Disconnect (Account) | Disconnect Google? | You’ll log in with your username and password. You can connect Google again here. | Disconnect (Disconnecting…) | Couldn’t disconnect Google. Check your connection and try again. |
| Exit demo (header) | Exit the demo? | Its builds can’t be opened again and are deleted after 24 hours. | Exit demo | none: it logs out even when the server can't be reached |

- The part's and cost's names come from the row (`name`, `label`), in curly quotes like the
  build's and bundle's dialogs. A part inside a bundle gets the same dialog.
- The inline "Couldn’t delete the part/cost…" lines under each list go: the dialog shows the
  error instead.
- Exit demo then does what it does today (logs out, back to Log in).

## How it works

**Frontend only, no API change.**

- `DeleteDialog` becomes `ConfirmDialog`, which takes the title, message, button, its running
  label and the error. `DeleteDialog` stays, as `ConfirmDialog` with the delete words, so the
  build and bundle dialogs don't change.
- `PartsTable` and `ExtraCosts` open it the way `PartsTable` already opens the bundle's
  (`confirming` state), instead of deleting at once.
- `GoogleRow` (Account) and the header's Exit demo open `ConfirmDialog`.

## Commands

Same as [specs/app.md](app.md#commands): `npm test`, `npm run lint`, `npx tsc -b` and
`npm run e2e` in `frontend/`.

## Project Structure

```
frontend/src/components/DeleteDialog.tsx   ConfirmDialog; DeleteDialog on top of it
frontend/src/components/PartsTable.tsx     a part's dialog; no inline delete error
frontend/src/components/ExtraCosts.tsx     a cost's dialog; no inline delete error
frontend/src/pages/Account.tsx             Disconnect's dialog
frontend/src/App.tsx                       Exit demo's dialog
frontend/src/*.test.tsx                    the tests that delete, disconnect or exit
frontend/e2e/demo.spec.ts                  Exit demo, if a test clicks it
specs/app.md                                    the Build detail and header lines
```

## Code Style

One dialog, named by what it asks:

```tsx
<ConfirmDialog
  title="Disconnect Google?"
  message="You’ll log in with your username and password. You can connect Google again here."
  action="Disconnect"
  running="Disconnecting…"
  error="Couldn’t disconnect Google. Check your connection and try again."
  onConfirm={disconnect}
  onClose={() => setConfirming(false)}
/>
```

## Testing Strategy

- **Vitest:** for each of the four, clicking opens the dialog with its words; Cancel closes it
  and sends nothing; the action sends the request (DELETE part, DELETE extra cost, DELETE
  `/auth/google/connect/`, POST `/auth/logout/`) and closes it; a failed request keeps it open
  with the error (not for Exit demo). Existing tests that delete a part or a cost, disconnect or
  exit click through the dialog.
- **E2E:** the existing tests that delete or exit click through the dialog; none new
  ([e2e intent](intent/e2e-tests.md)).
- **Manual:** each dialog at desktop and 375px, light and dark.

## Boundaries

- **Always:** Cancel first and focused; Esc closes without acting; words as above.
- **Ask first:** asking before any other action; undo instead of a dialog.
- **Never:** acting before the dialog's button is clicked.

## Success Criteria

1. Deleting a part or an extra cost, Disconnect and Exit demo each ask first, with the words
   above, and Cancel or Esc changes nothing.
2. Confirming does what the button did before; a failed delete or disconnect keeps the dialog
   open with its error.
3. Deleting a build or a bundle looks and works as before.
4. All tests pass; checked on the live site after the deploy, at desktop and 375px, light and
   dark.

## Open Questions

None. The words above are approved as written, and the four dialogs (plus a failed delete)
are designed on **Ready for development**, section "Confirm dialogs" (`154:6321`), light and
dark, desktop and mobile; both approved 2026-11-21.
