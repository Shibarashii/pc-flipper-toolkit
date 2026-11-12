# Spec: Google sign-in

Sign in with Google next to username and password, on top of [SPEC.md](../../SPEC.md), which
stays the source of truth for everything else. Intent agreed in conversation on 2026-11-07.

## Objective

- **Log-in and sign-up pages:** a "Sign in with Google" button beside the username and
  password form, which stays as it is.
- **New users:** the first Google sign-in creates an account and logs it in.
- **Existing users:** a new **Account** page lets them connect their Google account, so either
  way of signing in opens the same builds.

- **Why:**
  - Flippers get in without making up yet another password.
  - Recruiters see a real OpenID Connect sign-in, done the way Google documents it.
- **Users:** anyone signing up or logging in, and anyone with an account who wants Google too.

### User stories

1. On the log-in or sign-up page, I press the Google button, pick my Google account, and land
   on my builds list. The first time, that makes my account. Its username comes from my email
   (`seanrei.ethan23@gmail.com` → `seanrei.ethan23`).
2. Clicking my username in the header opens **Account**. It shows my username and "Connect
   Google".
3. After I connect, Account shows "Connected as seanrei.ethan23@gmail.com". I log out, sign in
   with Google, and see my same builds.
4. "Disconnect Google" unlinks it. It's only offered when my account also has a password, so I
   can't lock myself out.
5. A Google account that's already connected to another account can't be connected to mine.
   Account says so.
6. Username and password log-in, sign-up, and the demo work exactly as before.

### Rules

- **Who you are is Google's `sub`**, the account's permanent id, never the email. Emails can
  change or be reused; `sub` can't. The email is stored only to show "Connected as …".
- **Usernames for new Google accounts:**
  - The part of the email before the `@`, kept to the characters usernames allow
    (letters, digits, `@ . + - _`) and at most 150 characters.
  - If that name is taken (ignoring case, as sign-up does), a number is added: `name2`,
    `name3`…
  - It never starts with `demo-`: such a name gets `user-` in front.
  - An empty result (an email of only symbols) becomes `user`, then numbered.
- **Google-only accounts have no usable password**, like demo accounts. Demo cleanup still
  can't catch them, because it also needs the `demo-` prefix, which these names never have.
- **Demo accounts can't connect Google.** The demo is deleted after 24 hours. Account tells a
  demo user to sign up for their own account first.
- **Rate limit:** the new sign-in endpoint shares the existing 10-a-minute `auth` limit.

### Out of scope

- Other providers (Facebook and others).
- Editing the profile, changing the username, choosing a currency: these go to the backlog as
  the Account page's next step.
- Setting a password on a Google-only account.
- On the log-in page, asking "already have an account?" before creating a new one.
- Google One Tap and automatic sign-in; preview deployments (their URLs change, so Google
  can't list them).

## Approach

**Google Identity Services (GIS), ID-token flow.** This is Google's current, documented way
to add "Sign in with Google" to a web app.

1. The frontend loads Google's script (`https://accounts.google.com/gsi/client`) on the pages
   that need it, and renders Google's button.
2. Google's pop-up signs the user in and hands the page an **ID token**, a JWT signed by
   Google.
3. The frontend POSTs it to our API. The backend verifies it with Google's library: the
   signature against Google's keys, `aud` is our client id, `iss` is Google, and it hasn't
   expired. Then it reads `sub` and `email`.
4. The backend finds or creates the user and answers with our usual token, exactly as
   log-in does.

- **No client secret.** This flow only needs the public client id, so there's no secret to
  store anywhere.
- **No redirects** and no OAuth `state` to keep across our two domains (Vercel and Render).
- **Alternative considered:** a server-side authorization-code flow with PKCE (redirect to
  Google, callback on the API, then hand the token over to the frontend). It keeps Google's
  script off our pages. But it needs a client secret, signed state cookies, and a safe way
  to pass the token from Render's domain to Vercel's. That's more code and more to get
  wrong, for the same result.

### New dependency (approved 2026-11-07)

- **`google-auth`** (Google's official Python library), for `id_token.verify_oauth2_token`,
  with its `requests` transport to fetch Google's keys. It brings a handful of packages with
  it (`requests` and a few small libraries it depends on).
- Verifying a JWT by hand would be the riskier choice. Google's `tokeninfo` endpoint is meant
  for debugging, not production.
- Versions are pinned in `requirements.txt` as usual.
- No frontend package: Google's script is loaded at runtime, and its types are a few lines.

## Data model

```python
class GoogleAccount(models.Model):
    """A Google account connected to a user (docs/specs/google-sign-in.md)."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="google")
    sub = models.CharField(max_length=255, unique=True)  # Google's permanent id
    email = models.EmailField()  # shown only; not who they are
    connected_at = models.DateTimeField(auto_now_add=True)
```

- One Google account per user and one user per Google account (both unique).
- A new table, so the migration is safe while the old code runs.
- Deleted with the user (demo cleanup, account deletion in the admin).

## API

| Method | Path | Body | Answers |
|---|---|---|---|
| POST | `/api/auth/google/` | `{"credential": "<ID token>"}` | 200 `{token, username}` when the Google account is connected; 201 for a new account; 400 `credential` for a bad token. No auth; `auth` rate limit. |
| GET | `/api/auth/me/` | | adds `google` (`{email}` or `null`), `has_password` and `is_demo` to today's `{username}` |
| POST | `/api/auth/google/connect/` | `{"credential": "<ID token>"}` | 200 `{google: {email}}`; 400 when it's connected elsewhere, this user already has one, or the user is a demo |
| DELETE | `/api/auth/google/connect/` | | 204; 400 when the account has no password (or nothing is connected) |

- **Messages:**
  - "This Google account is connected to another account."
  - "Disconnect Google first." (this account already has one)
  - "Set up a password first; it's the only other way in."
  - "Demo accounts can't connect Google. Sign up for your own account first."
  - "Google sign-in didn't work. Try again." (bad, expired or wrong-audience token)
- **The server holds the client id** as `GOOGLE_CLIENT_ID`. Without it, `/api/auth/google/`
  answers 400 "Google sign-in isn't set up.", and the app works as today.
- **API docs:** the new endpoints are under `auth`, with examples.

## Frontend

- **Client id:** `VITE_GOOGLE_CLIENT_ID` (a client id is public). When it's unset, no Google
  button shows anywhere, so CI, e2e and local setups without it look like today.
- **Script:** Google's script loads only on the log-in/sign-up page and on Account. It's
  loaded when needed, not in `index.html`.
- **Log-in and sign-up page:**
  - Google's button sits under the form, above "Try the demo", after a hairline (an "or"
    line was planned; the hairline was kept after the live check, 2026-11-10).
  - Errors show where the form's errors show.
  - After sign-in it goes where a password log-in goes (the `from` address, or the list).
- **Header:** the username becomes a link to `/account`.
- **Account page (`/account`):**
  - The heading "Account", then the username.
  - A "Google" row: "Connect Google" (Google's button) or "Connected as …" with "Disconnect".
  - A demo user sees the "sign up first" line instead of the button.
  - It follows the brand guidelines: hairlines, no cards.
- **CSP** (`vercel.json`): add Google's documented origins for GIS:
  - `script-src https://accounts.google.com/gsi/client`
  - `frame-src https://accounts.google.com/gsi/`
  - `connect-src https://accounts.google.com/gsi/`
  - `style-src https://accounts.google.com/gsi/style`
- **Referrer-Policy:** `strict-origin-when-cross-origin` (the browser default) instead of
  `same-origin`, as Google's setup guide recommends for loading its script. Other sites
  still see only our origin, never a page's path (decided 2026-11-07 while building).
- **Inline styles stay blocked** (decided 2026-11-08 in review): Google's script also adds a
  `<style>` tag and `style` attributes for the stand-in it shows while its button's iframe
  loads. `style-src` blocks them, so the console shows 3 CSP errors. Unstyled, the stand-in
  is a full-width Google logo (found live, 2026-11-10), so the button's container hides
  everything but the iframe; the room for the button stays empty until it loads. Allowing
  the styles would need `'unsafe-inline'` for every style on the site, which isn't worth it.
- **Privacy page (`/privacy`)**, linked from the log-in page's footer: what the app stores
  (the username, the Google account's email and id, the builds) and that nothing is shared
  or sold. Google needs its URL to publish the app (added 2026-11-08, T42).

## Setup outside the code (the author does these)

1. **Google Cloud project:**
   - Make an OAuth consent screen: External, the app's name, support email, scopes `openid`,
     `email` and `profile` only. These aren't sensitive scopes, so Google doesn't need to
     review the app.
   - Publish it so any Google account can sign in, not only test users. Publishing needs a
     homepage URL (the live site) and a privacy policy URL (its `/privacy` page), and Google
     may ask to verify the domain.
   - Showing the app's logo on Google's sign-in screen needs brand verification, which needs
     the site's ownership proved in Google Search Console (a URL-prefix property for the live
     site). The proof is `frontend/public/google0717eefd8353a321.html`; Google checks it
     again from time to time, so it must stay (added 2026-11-12).
2. **OAuth client:** Web application. Authorized JavaScript origins:
   - `https://pc-flipper-toolkit.vercel.app`
   - `http://localhost`, `http://localhost:5173` and `http://localhost:5199` (Google asks for
     plain `http://localhost` as well as each port)

   No redirect URIs; the pop-up flow doesn't use them.
3. **Client id in the environments:**
   - The same id goes in as `GOOGLE_CLIENT_ID` on Render and in `backend/.env`.
   - It goes in as `VITE_GOOGLE_CLIENT_ID` on Vercel and in `frontend/.env`.
   - It isn't a secret, but it stays out of git like the rest of `.env`.
4. Mention it in the README's run-it-locally section (optional locally; without it there's
   no Google button).

## Commands

Same as [SPEC.md](../../SPEC.md#commands): `python manage.py test`,
`python manage.py makemigrations --check`, `ruff check . && ruff format .` and
`python manage.py spectacular --validate --fail-on-warn` in `backend/`; `npm test`,
`npm run lint`, `npx tsc -b` and `npx playwright test` in `frontend/`.

## Project Structure

```
backend/
  requirements.txt       + google-auth (+ requests), pinned
  config/settings.py     GOOGLE_CLIENT_ID from the environment
  config/urls.py         /api/auth/google/, /api/auth/google/connect/
  builds/models.py       + GoogleAccount
  builds/migrations/0009_…  the new table
  builds/google.py       verify the ID token; pick a username
  builds/auth.py         GoogleView, GoogleConnectView; me gains google/has_password/is_demo
  builds/tests.py        + the tests below
frontend/
  vercel.json            CSP for Google's script, frame and styles
  .env.example           VITE_GOOGLE_CLIENT_ID
  src/google.ts          load Google's script once; render its button
  src/api.ts             googleSignIn, connectGoogle, disconnectGoogle; Me type
  src/pages/Login.tsx    the Google button
  src/pages/Account.tsx  the Account page
  src/App.tsx            /account route; username links to it
docs/ideas/backlog.md    + Account page: profile and currency
SPEC.md, README.md       auth table, Account screen, setup notes
```

## Testing Strategy

- **Backend.** Google's verify call is mocked; nothing calls Google in tests.
  - A new `sub` creates a user with no usable password and the email's username, and answers
    201 with a token. The same `sub` again logs into that user (200).
  - Usernames: a taken name gets `2`, then `3`; case doesn't matter; symbols are dropped;
    `demo-x@…` becomes `user-demo-x`; an empty name becomes `user`.
  - A bad, expired or wrong-audience token, and a missing `GOOGLE_CLIENT_ID`, give 400 and
    create nothing.
  - Connect: links the current user. It refuses a `sub` connected elsewhere, a second Google
    account, and demo users.
  - Disconnect: 204 with a password; 400 without one.
  - `me` reports `google`, `has_password` and `is_demo`.
  - The 11th Google sign-in in a minute is 429, shared with log-in.
  - Demo cleanup never deletes a Google-only account, even one older than 24 hours.
- **Frontend.** Google's `window.google.accounts.id` is stubbed.
  - No client id: no button.
  - With one: the button renders. A credential POSTs to the API, saves the session and
    navigates.
  - Account: the connect, connected, disconnect and demo states, and the API's error
    messages.
  - The header's username links to Account.
- **E2E:** unchanged; CI has no client id, so no Google button. Real Google can't be
  automated in CI. The existing tests prove password log-in, sign-up and the demo didn't
  change.
- **Live check:** with the client id set, on the live site:
  - A new Google sign-in lands on its builds.
  - A password account connects Google, logs out, signs in with Google and sees its builds.
  - It disconnects again.
  - A second account can't connect the same Google account.

## Boundaries

- **Always:**
  - Verify every ID token on the server with Google's library.
  - Identify users by `sub`.
  - Keep the `auth` rate limit.
  - Keep password log-in working.
- **Ask first:**
  - More providers.
  - Matching accounts by email.
  - Setting passwords for Google-only accounts.
  - Storing anything from Google beyond `sub` and `email`.
  - Loosening the CSP beyond Google's documented GIS origins.
- **Never:**
  - Trust a token the frontend says is valid.
  - Log or store the ID token.
  - Let Google sign-in make a `demo-` username.
  - Put any Google value in git.

## Success Criteria

1. On the live site, a first Google sign-in creates an account (username from the email) and
   opens its builds; signing in again opens the same account.
2. A password account connects Google on Account, then signs in with Google to the same
   builds, and can disconnect (only while it has a password).
3. A Google account connected to one user can't be connected to another; demo users can't
   connect at all.
4. Password log-in, sign-up and the demo are unchanged (the existing e2e tests pass), and the
   app works with no client id set.
5. All tests pass, and the API docs validate with the new endpoints.

## Open Questions

None. Decided 2026-11-07: add `google-auth` (with `requests`), and use Google's button and
pop-up (the ID-token flow) rather than the redirect flow.
