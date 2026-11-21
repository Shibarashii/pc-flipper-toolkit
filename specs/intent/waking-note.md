# Intent: say when the API is waking up

Confirmed by the author on 2026-11-21 (interview-me).

- **Outcome:** while the API answers slowly, you always see that something is happening, and
  after 5 seconds you're told why.
- **User:** everyone: first-time visitors trying the demo or signing up, and the author.
- **Why now:** the API is on Render's free plan, which sleeps after 15 minutes idle; the first
  request can take up to a minute, and today the buttons only fade, so the site looks stuck.
- **Where:** a spinner and working words ("Logging in…", "Creating account…", "Starting the
  demo…") in the pressed button for log in, sign up, Google sign-in and Try the demo (the
  log-in page and both copies on the landing page). Page loads (builds list, a build, account)
  keep their skeletons.
- **Success:** after 5 seconds, a muted line by the button or the skeleton: "Waking up the
  server — this can take up to a minute. It runs on Render’s free plan, which sleeps when
  nobody’s using it."
- **Constraint:** the brand's look (`specs/design/brand.md`), no new dependency, reduced motion
  respected.
- **Out of scope:** saves, deletes, dialogs and price lookups (the server is awake by then); a
  timeout or retry; keeping the server awake.
