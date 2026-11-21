# Intent: Demo account

Confirmed 2026-10-29.

- **Outcome:** "Try the demo" on the log-in and sign-up pages creates a throwaway account, logs the viewer in, and shows two sample builds: a sold flip with a bundle, extra costs and a profit, and one in progress with gaps in the checklist. Viewers can edit anything. A banner says it's a demo, deleted after 24 hours, and offers sign-up.
- **User:** People who find the live link through the author's portfolio or applications (recruiters, other developers).
- **Why now:** The link is being shared now, and the sign-up wall turns viewers away.
- **Success:** One click to a realistic flip; viewers never see each other's edits; demo accounts go away on their own.
- **Constraint:** Server-side, reusing the existing models and rules (a client-side fake API would duplicate the money logic and could drift from the real app). Demo creation shares the 10-a-minute limit. No new dependencies. A test guards the sample data so later features can't quietly break it.
- **Out of scope:** Turning a demo account into a real one, a shared or read-only demo, a client-side fake API, analytics, and sample data for features that don't exist yet.
