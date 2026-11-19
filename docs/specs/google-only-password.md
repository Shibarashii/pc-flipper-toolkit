# Spec: A password for Google-only accounts

An account made with "Sign in with Google" can add a password, the same way a forgotten one
is reset: a link to its recovery email. On top of [SPEC.md](../../SPEC.md), which stays the
source of truth; this undoes one "Out of scope" line in
[google-sign-in.md](google-sign-in.md) and [account-management.md](account-management.md).
Approved 2026-11-19 as written.

## Objective

- **What:** a Google-only account with a recovery email can set a password, from Account or
  from "Forgot your username or password?". Then it logs in either way, and can disconnect
  Google like any other account.
- **Why:** today a password account can add Google, but a Google-only account can never get
  a password: Account says "Not set" with no button, and the reset email skips it. If that
  person loses their Google account, they lose this one too. Most apps (GitHub, Notion,
  Figma) let you add a password later.
- **Users:** someone who signed up with Google and wants a second way in, or wants to stop
  using Google here.

### User stories

1. On Account, with Google as my only way in and a recovery email, I see "Set password". It
   emails me a link; the link opens "Set a new password"; after it, I log in with my
   username and the new password. Google stays connected until I disconnect it.
2. Without a recovery email, Account tells me to add one first.
3. "Forgot your username or password?" with my recovery email sends me the same link, even
   though I've never had a password.

### Out of scope

- Setting a password in place on Account, without the email. With no current password to
  check, a stolen session could add a password and keep the account; the emailed link
  proves you own the recovery email.
- Making a password required, or asking Google to sign in again.
- Any change to the reset page, the link's lifetime (1 hour) or its 15-minute wait.

## How it works

**No new endpoint, no migration.** The reset request already finds the account by its
email; it just stops skipping accounts without a password.

- **Backend** (`builds/auth.py`, `ResetRequestView`): drop `user.has_usable_password()`
  from the condition. Demo accounts can't have an email, so they still never match.
  `ResetView` already works on an unusable password: the link's token is made from the
  password hash, which changes once the password is set, so the link works once.
- **The email** (`builds/emails.py`, `reset_password`): two lines say "your password" as if
  there is one; they change so they read right for both kinds of account:
  - "If you forgot your password, open this link to set a new one:" → "To set a new
    password, open this link:"
  - "…you can ignore this email; your password stays as it is." → "…you can ignore this
    email; nothing changes."
- **Account** (`frontend/src/pages/Account.tsx`, the Password row when there's no
  password): the button calls the existing `askForResetLink(me.email)`.

## Frontend: Account, Ways to log in

Only the Google-only Password row changes. Everything else stays as built in
[portfolio-polish.md](portfolio-polish.md#part-3-account-page).

| State | Left | Right |
|---|---|---|
| Google-only, with a recovery email | "Password", "Not set" (muted) | "Set password" |
| Google-only, no recovery email | "Password", "Not set" (muted) | none |
| After "Set password" | (above the row) "We sent a link to x@y.com. Open it within 1 hour to set your password. Not there? Check your spam folder." | "Set password" stays |

- The left side matches the Google row: the label, then the value in muted.
- Under the rows, Google-only: "Google is your only way to log in, so it stays connected."
  Without a recovery email it adds: "Add a recovery email to set a password."
- Errors (too many tries, server down) show under the section's heading, like Google's.
- Setting the password logs every device out (as a reset does today), so the reset page's
  "Log in with your new password." is still right. The reset page doesn't change.

## Commands

Same as [SPEC.md](../../SPEC.md#commands): `python manage.py test` and `ruff check .` in
`backend/`; `npm test`, `npm run lint`, `npx tsc -b` and `npm run e2e` in `frontend/`.

## Project Structure

```
backend/builds/auth.py        ResetRequestView: one condition fewer
backend/builds/emails.py      reset_password: two lines reworded
backend/builds/tests.py       the reset tests
frontend/src/pages/Account.tsx  the Google-only Password row
frontend/src/App.test.tsx       its tests
SPEC.md                       the password-reset row; Screens: Account
docs/specs/google-sign-in.md, account-management.md  a "(Changed …)" note on the out-of-scope line
```

## Code Style

The backend change is a deletion:

```python
user = User.objects.filter(email__iexact=email, is_active=True).first()
# A Google-only account gets the link too: it's how one adds a password. Demo accounts
# never have an email, so they never match.
if user and cache.add(f"reset:{email_mark(email.lower())}", True, RESET_WAIT):
```

## Testing Strategy

- **Backend (Django tests):**
  - The "same answer for every address" test: a Google-only account with an email now gets
    the email too (inactive and unknown addresses still don't).
  - A Google-only account sets a password from the link, then logs in with it; Google is
    still connected; disconnecting Google now works; the link doesn't work twice.
  - The email's two reworded lines.
- **Frontend (Vitest, `App.test.tsx`):** the Password row, word for word, in the three states
  above; "Set password" posts `{email}` to `/auth/password-reset/`; 429 shows under the
  heading; still one verb on the page.
- **E2E:** none new ([e2e intent](../intent/e2e-tests.md)).
- **Manual:** a local Google-only account with an email: Set password, open the link from
  the console email, log in with the password.

## Boundaries

- **Always:** the link goes only to the account's confirmed recovery email; the reset
  request's answer stays the same for every address.
- **Ask first:** setting a password without the email; any change to the reset page, the
  link's lifetime or the wait.
- **Never:** a way to add a password that doesn't prove the email; telling the caller of
  the public reset endpoint whether an account is Google-only.

## Success Criteria

1. A Google-only account with a recovery email sets a password from Account, and from
   Forgot, then logs in with its username and that password.
2. After that, Account shows "Password" with Change, and Google with Disconnect.
3. Without a recovery email, Account says to add one and offers no button.
4. The reset email reads right for an account that never had a password.
5. All tests pass; checked on the live site after the deploy.

## Open Questions

None. The words above are approved as written, and the three states are designed on
**Ready for development**, section "Google-only password" (`150:4`), light and dark; both
approved 2026-11-19.
