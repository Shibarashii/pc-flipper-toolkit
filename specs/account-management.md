# Spec: Account management

Changing a username and password, a verified email on every account, and "Forgot your
username or password?", on top of [specs/app.md](app.md), which stays the source of truth
for everything else, and [google-sign-in.md](google-sign-in.md), which added the Account
page. Intent confirmed in conversation on 2026-11-17.

It follows three sources, checked on 2026-11-17:

- OWASP's [Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html):
  the same answer whether an account exists or not, rate limits but no lockout, random
  single-use links that expire, no automatic log-in after a reset, other sessions logged out,
  a "password changed" email, `Referrer-Policy: no-referrer` on the reset page, and links
  built from a fixed URL, never the request's host.
- Django's [password reset](https://docs.djangoproject.com/en/5.2/topics/auth/default/):
  `default_token_generator` (its links stop working once the password changes) and its rule
  of sending nothing to inactive users or users without a usable password.
- Google's [ID token guide](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token):
  `sub` is who the Google account is, not its email; Google vouches for an email only when it
  says it's verified and it's a Gmail or Google Workspace address; accounts are never merged
  automatically because their emails match.

## Objective

- **What:** the account management people expect from an app, in three parts that ship in
  order:
  1. **Change username and password** on the Account page.
  2. **A verified email on every account:** required at sign-up, added from the Account page
     by existing accounts, changed later with a new confirmation.
  3. **"Forgot your username or password?"** on the log-in page: an email with the username
     and a link to set a new password.
- **Why:** v1 is feature-complete, and account management is the visible gap next to apps
  people know. Nobody has been locked out yet; this is about the app being complete and
  showing it's built carefully.
- **Users:** the author and real users; scouts and employers, who mostly judge it from the
  code, the tests and the README, since the demo has no password.

### User stories

1. On Account, I change my username; the header shows the new one, and I log in with it.
2. On Account, I change my password by typing the current one and a new one. I stay logged
   in here; my other devices are logged out.
3. Signing up, I give an email. A link arrives; once I open it, Account shows the email.
4. My account from before this has no email; Account asks me to add one, and I do.
5. I change my email; the link goes to the new address, and my old address is told.
6. I forgot my password. "Forgot your username or password?" asks for my email; the email it
   sends has my username and a link. I set a new password, then log in with it.
7. A link I've used, or one older than an hour, says it no longer works and offers a new one.

### Out of scope

- A password for Google-only accounts (out of scope in the Google sign-in spec too); they log
  in with Google. (Changed 2026-11-19: now possible through the reset link; see
  [google-only-password.md](google-only-password.md).)
- Deleting an account, two-factor authentication, CAPTCHA, an email on every log-in.
- Logging in with the email instead of the username.
- Choosing the currency (the other half of the backlog's Account page idea; it stays there).
- Demo accounts: they can't rename, change a password or add an email (they have no
  password, and renaming one would take it out of the 24-hour cleanup, which finds them by
  their `demo-` prefix).

## Data model

- **No new table.** Django's `User.email` is already there, blank on every account.
- **Only verified emails are stored.** An address is saved when its confirmation link is
  opened, never when it's typed, so every stored email belongs to its account.
- **Unique, ignoring case and blanks:** migration `0010` adds a Postgres unique index on
  `lower(email)` where `email <> ''` (`RunSQL`, since `auth_user` belongs to Django's auth
  app). Every row is blank today and the old code never writes `email`, so it's safe while
  the old code runs. The API checks first, so a clash is a message, not a 500.

## API

All new endpoints are documented (summary, description, field help text, examples), like
the existing auth ones. Public ones share the `auth` rate limit (10 a minute per IP).
Demo users get `403` from every endpoint that changes their account.

### Part 1: username and password

| Endpoint | Body | Result |
|---|---|---|
| `PATCH /api/auth/me/` | `{username}` | `200` with `me`. The sign-up rules: Django's username validators, not taken by another account ignoring case, not starting with `demo-`. Changing only the case of your own name is allowed. |
| `POST /api/auth/password/` | `{current_password, new_password}` | `200` with a new `{token, username}`. Wrong current password: `400` on `current_password`. The new one must pass Django's validators (`400` on `new_password`). The old token is deleted, so every other device is logged out; this one gets the new token. Rate-limited (`auth`). An account without a usable password (Google-only): `400`. |

### Part 2: email

| Endpoint | Body | Result |
|---|---|---|
| `POST /api/auth/signup/` | + `email` (required) | As today, then a confirmation link goes to the email. The account works at once; the email is saved when the link is opened. |
| `POST /api/auth/email/` | `{email}` | Logged in. Sends a confirmation link to that address: `202`. If another account already has it: `400` on `email` ("That email is used by another account."); you're logged in, so this tells you nothing about strangers. If the account already had an email, a notice goes to the old address once the new one is confirmed. 5 sends an hour per account (`429` after), since each is an email and Brevo's free plan sends 300 a day for everyone. |
| `POST /api/auth/email/confirm/` | `{token}` | Public (the link may be opened on another device). Saves the email and returns `{email}`. Expired, already used or tampered: `400` on `token`. If another account confirmed the same address in between: `400` on `email`. |
| `GET /api/auth/me/` | | + `email` (`""` when none). |
| `POST /api/auth/google/` | | A **new** Google account takes Google's email when Google marks it verified and it's a Gmail or Workspace (`hd`) address, and no other account has it. Otherwise it starts with none and Account asks for one. Existing users are never matched by email. |

**Confirmation tokens:** `django.core.signing` with a salt, holding the user's id, the new
email and the account's current email, valid for 24 hours. Opening a link checks the
account's email is still the one it was sent from, so a link stops working once it's been
used or another change has happened. (The id is readable in the token, as in Django's own
reset links; it's signed, so it can't be changed.)

### Part 3: forgot username or password

| Endpoint | Body | Result |
|---|---|---|
| `POST /api/auth/password-reset/` | `{email}` | Always `202` with the same message: "If an account has that email, we've sent it a link." Only an active account with that email (ignoring case) and a usable password gets one: its username and a link. Sent in a background thread, so the answer takes as long either way. One email per address per 15 minutes, silently; never a lockout. |
| `POST /api/auth/password-reset/confirm/` | `{uid, token, new_password}` | `204`. Django's `default_token_generator`, with `PASSWORD_RESET_TIMEOUT = 3600` (1 hour). The new password must pass the validators. Sets it, deletes the token (every device logged out), and emails "Your password was changed". It doesn't log in. Expired, used or tampered: `400` on `token`. |

- **Links are built from `SITE_URL`** (`https://pc-flipper-toolkit.vercel.app`), never from
  the request.
- **Forgot username** is the same request: the email names the username, so there's no
  separate form.

## Email

- **Brevo** over Django's built-in SMTP backend: no new Python package.
- **Settings from the environment** (`backend/.env.example` documents them): `EMAIL_HOST`
  (from Brevo's SMTP settings page), `EMAIL_PORT=2525` (Render's free plan blocks the usual
  587; Brevo also takes 2525), `EMAIL_USE_TLS=1`, `EMAIL_HOST_USER` (Brevo's SMTP login),
  `EMAIL_HOST_PASSWORD` (a Brevo **SMTP key**, not an API key), `DEFAULT_FROM_EMAIL` (the
  sender verified in Brevo), `SITE_URL`.
- **No `EMAIL_HOST`** (local development, CI): Django's console backend, so emails print in
  `runserver`'s output. Tests use Django's in-memory outbox.
- **Emails with a text and an HTML version** (Brevo turns a text-only email into HTML with a
  tracking image, which spam filters mark down; S1's test, 2026-11-18), a few lines each:
  what happened, the link, how long it works, and "If this wasn't you, you can ignore this
  email" (or, for the change notices, "log in and change your password").
- **Secrets stay in Render's environment,** never in the repo.

## Frontend

**Design** (approved 2026-11-17), on Figma's *Ready for development* page, light and dark:
[Account](https://www.figma.com/design/Wp4dGW94gTWFjwZSha3nby?node-id=129-393) (desktop,
mobile, and every row's states),
[Log in & sign up](https://www.figma.com/design/Wp4dGW94gTWFjwZSha3nby?node-id=129-389),
[Recovery](https://www.figma.com/design/Wp4dGW94gTWFjwZSha3nby?node-id=129-391) (`/forgot`,
`/reset-password`, `/verify-email` and the sign-up notice). Words come from the list under
"Wording" below; sizes from the existing code where the two differ.

### Account page (`/account`)

Under "Logged in as …", three sections with hairlines, like the Google one, each a row that
opens an edit form in place. (Changed 2026-11-19: the page is regrouped into Username, Ways to log in and Recovery email, with new words; see [portfolio-polish.md](portfolio-polish.md#part-3-account-page).)

- **Username:** the name, "Change". The form: one field, Save and Cancel.
- **Email:** the email and "Change", or "No email yet. Add one so you can get back in if
  you forget your password." and "Add email". After sending: "We sent a link to …. It works
  for 24 hours."
- **Password:** "Change" opens Current password and New password (`autocomplete`
  `current-password` and `new-password`). Google-only accounts see "You log in with Google"
  instead.
- **Google:** as today.
- **Demo accounts** see one line instead of these rows and Google (see "Wording").

### Log-in and sign-up (`Login.tsx`)

- **Sign-up** gets an Email field (`type="email"`, `autocomplete="email"`, required), then
  "We sent a link to … to confirm your email." on the builds list it opens.
- **Log-in** gets a "Forgot your username or password?" link under the form.

### New pages, logged in or out

- `/forgot`: one email field and the same message whatever happens.
- `/reset-password?uid=…&token=…`: New password, then "Password changed. Log in with your
  new password." and a link to log in. A bad link offers `/forgot`.
- `/verify-email?token=…`: confirms on load, then "Email confirmed" (and a link to Account)
  or why not.
- **Referrer-Policy `no-referrer`** on `/reset-password` and `/verify-email`, in
  `vercel.json`, since their URLs carry tokens.

### Wording

Approved with the designs. Errors not listed here are Django's own messages (e.g. "A user with
that username already exists.", "This password is too common.").

- **Account, Username:** "Change"; the form's buttons "Save" and "Cancel".
- **Account, Email:** "No email yet. Add one so you can get back in if you forget your
  password." / "Add email"; sent: "We sent a link to {email}. It works for 24 hours. If it
  doesn’t arrive, check your spam folder."; taken: "That email is used by another account."
- **Account, Password:** "You log in with a password." and "Change"; the form's button "Change
  password"; wrong current password: "That isn't your current password."; done: "Password
  changed. Your other devices are logged out."; Google-only: "You log in with Google."
- **Account, demo:** "Demo accounts can't change their account. Sign up for your own account
  first." (replaces today's Google-only line).
- (Changed 2026-11-19: the Account words above are replaced; see
  [portfolio-polish.md](portfolio-polish.md#part-3-account-page).)
- **Log in:** the link "Forgot your username or password?". **Sign-up:** the field "Email";
  on the builds list after: "We sent a link to {email} to confirm your email. If it doesn’t
  arrive, check your spam folder."
- **`/forgot`:** title "Forgot your username or password?"; "Type your account's email. We'll
  send your username and a link to set a new password."; "Send link"; "Back to log in"; sent:
  "If an account has that email, we've sent it a link. It works for 1 hour. If it doesn’t
  arrive, check your spam folder."
- **`/reset-password`:** "Set a new password", the field "New password", "Set password"; done:
  "Password changed" / "Log in with your new password." and "Log in"; bad link: "This link no
  longer works" / "Reset links work once, for 1 hour. Ask for a new one." / "Get a new link".
- **`/verify-email`:** "Email confirmed" / "{email} is on your account now." / "Go to
  Account"; bad link: "This link no longer works" / "Confirmation links work once, for 24
  hours. Add your email again on Account to get a new one." / "Go to Account".

Text uses curly apostrophes (’), as the rest of the app does.

### Other screens

- **Privacy page:** the app stores your email, and sends it to Brevo only to deliver these
  emails.
- **specs/app.md** (auth table, Account screen), **README** (Brevo setup).

## Setup outside the code (the author does these)

Before part 2 ships, since its confirmation emails are the first ones sent:

1. Create a Brevo account and verify the sender address.
2. Create an SMTP key; put the login, key, host, sender and `SITE_URL` in Render's
   environment.
3. Send a test email to a Gmail address and another provider: it must land in the inbox, not
   spam. If it lands in spam, stop and decide what to do (a domain of your own, a different
   sender) before shipping. **Decided 2026-11-18:** the Gmail sender stays for now (Gmail's
   inbox got the test; mail-tester 5.5/10, mostly for the free-address sender), with "check
   your spam folder" in the sent messages; a domain of our own is parked in the
   [backlog](ideas/backlog.md#parked).

## Commands

Same as [specs/app.md](app.md#commands): `python manage.py test`,
`python manage.py makemigrations --check`, `ruff check . && ruff format .` and
`python manage.py spectacular --validate --fail-on-warn` in `backend/`; `npm test`,
`npm run lint`, `npx tsc -b` and `npx playwright test` in `frontend/`.

## Project Structure

```
backend/builds/
  auth.py               + the new views and serializers
  emails.py             (new) the email texts and sending, in a background thread
  migrations/0010_…     the unique index on lower(email)
  tests.py              + the tests below
backend/config/
  settings.py           email settings, SITE_URL, PASSWORD_RESET_TIMEOUT
  urls.py               + the new endpoints
backend/.env.example    + the email settings
frontend/src/
  api.ts                + the new calls; Me.email
  pages/Account.tsx     + Username, Email and Password rows
  pages/Login.tsx       + Email on sign-up; the forgot link
  pages/Forgot.tsx, ResetPassword.tsx, VerifyEmail.tsx   (new)
  pages/Privacy.tsx     + email and Brevo
  App.tsx               + the three routes, logged in and out
frontend/vercel.json    no-referrer on the two link pages
specs/app.md, README.md      auth table, Account screen, Brevo setup
```

## Testing Strategy

- **Backend (`tests.py`, most of the tests):**
  - Rename: works; taken (any case) and `demo-` refused; changing only your own case allowed;
    the old name no longer logs in; demo `403`.
  - Change password: wrong current refused; validators apply; the old token gets `401`, the
    new one works; Google-only `400`; demo `403`.
  - Email: sign-up needs a valid one and sends a link (outbox); nothing is saved until it's
    opened; a link works once, and not after 24 hours (frozen clock) or after another
    change; another account's email is refused at sending and at confirming; the old address
    gets a notice; a new Google account takes a verified Gmail address and not an unverified
    or taken one; an existing account is never matched by email.
  - Reset: the same response and status for a known email, an unknown one, a Google-only
    account and an inactive one, and only the first gets an email; the email has the
    username and a link starting with `SITE_URL`; the link works once, not after an hour, and
    not after the password changes; the reset deletes the token and sends the notice; one
    email per address per 15 minutes; it never locks the account.
  - Migration: two accounts can't have the same email in different case; many can have none.
- **Frontend (Vitest):** the Account rows and forms (including Google-only and demo), the
  sign-up Email field, the three new pages with good and bad links.
- **E2E:** the flip test's sign-up fills in an email. No new e2e file
  ([e2e intent](intent/e2e-tests.md)).
- **Manual, per part:** the flow on the live site at desktop and 375px, light and dark; for
  parts 2 and 3, the real emails arriving in an inbox.

## Boundaries

- **Always:** the same answer whether an account exists or not; links from `SITE_URL`;
  passwords through Django's validators; tokens deleted after a password change or reset;
  secrets only in Render's environment.
- **Ask first:** logging in by email, a password for Google-only accounts, deleting accounts,
  two-factor authentication, an HTML email template, another email provider.
- **Never:** say whether an email or username exists to someone not logged in; merge accounts
  because emails match; put a password in an email; log in automatically after a reset; lock
  an account after failed attempts.

## Success Criteria

1. **Part 1:** on the live site, a username change shows at once and logs in; a password
   change keeps this browser logged in and logs another one out.
2. **Part 2:** a new sign-up's confirmation email arrives in an inbox and its link saves the
   email; an existing account adds one from Account; a new Google sign-up shows its Gmail
   address on Account.
3. **Part 3:** "Forgot your username or password?" sends an email with the username and a
   link that sets a new password once, logs out other devices, and sends the notice; an
   unknown email gets the same message and no email.
4. Every point in the Testing Strategy has a passing test; all tests pass.
5. Every page fits 375px without sideways scrolling, light and dark.

## Open Questions

None. Decided 2026-11-17: all three parts, in order; email required at sign-up and verified
by link; Brevo over SMTP; the three sources above as the rules.
