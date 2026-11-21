# Spec: Portfolio polish

Small fixes to controls and words before the app goes in the author's portfolio, on top of
[specs/app.md](app.md), which stays the source of truth for everything else. Direction agreed
2026-11-19 in [specs/ideas/portfolio-polish.md](ideas/portfolio-polish.md).

## Objective

- **What:** three parts, each shippable on its own:
  1. **Icon buttons:** "Copy listing" and "Delete build" become icons with tooltips, and
     tooltips go where something is hidden.
  2. **Summary words:** the build summary's unclear labels get clearer words.
  3. **Account page:** regrouped and reworded so each line says plainly what's true and what
     its button does.
- **Why:** the app is about to be shared. Today the build header's two text buttons are the
  loudest thing beside the fields (one of them destructive), a few labels need explaining, and
  the Account page is confusing: it says "You log in with a password", mixes "log in" and
  "sign in", splits the ways in across two sections, and tells a Google-only account to add an
  email "if you forget your password".
- **Users:** a visitor clicking through the demo for two minutes (a hiring manager), and a
  flipper using the app every week. Both equally.

### User stories

1. On a build, I see two icons where "Copy listing" and "Delete build" were. Hovering either
   names it; a screen reader names it too. Clicking does what it did before.
2. Any control that shows only an icon names itself on hover. Text that's cut off shows in
   full on hover.
3. In a build's summary, I understand every figure without asking what it means.
4. On Account, I see my username, how I can log in, and my recovery email, each with one clear
   action, and nothing is said twice.

### Out of scope

- A brand-styled tooltip component (tooltips here only name things; meaning lives in visible
  words, since a `title` tooltip never shows on touch or keyboard focus).
- Copying the listing in one click without the dialog (the dialog lets you edit the post).
- Setting a password on a Google-only account, or any other new account feature.
- Renaming the part form's "Listed price" field or the API's field names.

## Frontend

### Part 1: Icon buttons and tooltips

- **Build header** (`BuildHeader.tsx`): the two buttons become square icon buttons, side by
  side where the text buttons were, still lined up with the inputs' bottom edge.
  - 38px square (the height of the buttons they replace), the secondary button's border and
    surface, a 16px icon, the brand's focus ring.
  - **Copy listing:** a sheet with text lines (the same 16px stroke style as the pencil), in
    ink. Named "Copy listing". Opens the listing dialog, unchanged.
  - **Delete build:** the rows' bin, in the loss colour as today. Named "Delete
    build". Opens the delete dialog, unchanged.
  - Every `IconButton` icon (pencil, bin, sheet) is drawn inline in `currentColor`, so muted,
    loss and ink follow the theme. `pencil.svg` and `trash.svg` carried the light theme's
    colours and are gone (built 2026-11-19, from the review).
  - Same icons and size on desktop and phones.
- **One way to name an icon:** `IconButton` (`form.tsx`) already sets `aria-label` and `title`
  from one `label`. It takes the listing icon and a 38px bordered look for the header, so
  every icon-only button gets its tooltip the same way.
- **Tooltips elsewhere** (native `title`, nothing new to build):
  - The header's username link, which truncates on narrow widths: `title` is the full username.
  - The build checklist's marks (filled, missing, optional): "Added", "Missing" and
    "Optional". They stay hidden from screen readers; the row's text already says it.
  - Already done, unchanged: row edit and delete, the theme toggle, the phone Account icon,
    the footer's GitHub and LinkedIn.
  - Not added: buttons and links that show words ("Add", "View", "Change").

### Part 2: Summary words

Approved by the author on 2026-11-19. Only the labels change, not the numbers or the API.

| Where | Today | Proposed | Why |
|---|---|---|---|
| Build summary | Listed total | Parts at shop prices | "Listed" also means the Marketplace status |
| Build summary | Below market / Above market | Under shop prices / Over shop prices | "Market" is vague; it compares against the same shop prices |
| Build summary | Voucher savings | Saved on parts | It's shop prices − what you paid, from vouchers or anything else |
| Bundle row | Listed total | Parts at shop prices | Same as the summary |
| Builds summary | Tied up | Unchanged | "Money tied up" is what flippers say; "in 3 builds" under it explains it |

specs/app.md's definitions (Objective, user story 3) take the new names in the same change.

### Part 3: Account page

One verb throughout: **log in**, as on the rest of the app (Google's own button keeps "Sign in
with Google"). The page, top to bottom:

- **Account** (the title). The "Logged in as …" line goes: the Username section says it.
- **Demo account:** instead of the sections, "This is a demo account, so its settings can't be
  changed. Sign up to get your own."
- **Username:** unchanged: the name, and Change, which opens the field with Save and Cancel.
- **Ways to log in:** one section, one row each, a label on the left and the action on the
  right, like Username:
  - **Password**
    - Set: "Password" and Change, which opens Current password, New password, Change password
      and Cancel (unchanged). After saving: "Password changed. You're logged out on your other
      devices."
    - Not set (a Google-only account): "Password" and "Not set" (muted), no button.
  - **Google**
    - Connected: "Google" and the Google email, with Disconnect when there's a password.
    - Not connected: "Google" and "Not connected", then Google's Sign in button.
  - Under the rows, muted: "Keep at least one way to log in." When Google is the only way, it
    reads "Google is your only way to log in, so it stays connected." instead.
  - Errors show under the section's heading, as today. Google's button failing to load reads
    "Couldn't load Google's button. Check your connection and reload." (was "Google sign-in";
    changed in the review, for one verb).
- **Recovery email:**
  - Set: the email and Change. Under it, muted: "Used if you forget your username or password."
    (Google-only: "Used if you forget your username.")
  - None: "No recovery email yet." with the same muted line, and Add email.
  - After sending: "We sent a link to x@y.com. Open it within 24 hours to confirm. Not there?
    Check your spam folder."
  - The form (the field, Send link and Cancel) is unchanged.

The order (Username, Ways to log in, Recovery email) and spacing follow today's page: a
hairline and an `editorial` heading per section.

## Commands

Same as [specs/app.md](app.md#commands): `npm test`, `npm run lint`, `npx tsc -b` and
`npm run e2e` in `frontend/`. No backend change.

## Project Structure

```
frontend/src/
  components/form.tsx           IconButton: the listing icon and the 38px bordered look
  components/BuildHeader.tsx    the two icon buttons
  components/BuildChecklist.tsx titles on the marks
  components/Summary.tsx        Part 2 labels
  components/BundleRow.tsx      Part 2 label
  App.tsx                       title on the username link
  pages/Account.tsx             Part 3
  (+ the tests beside each)
frontend/e2e/flip.spec.ts       only if it names a changed label
specs/app.md                         Part 2 names; Screens: Account
specs/design/brand.md        icon buttons in the header, if it lists the build header
```

## Code Style

The header's icon buttons go through `IconButton`, so the name is written once:

```tsx
<IconButton
  action="listing"
  label="Copy listing"
  onClick={() => setListing(true)}
  bordered
/>
```

## Testing Strategy

- **Unit (Vitest, beside each component):**
  - Build header: buttons named "Copy listing" and "Delete build" exist, show no text, have a
    matching `title`, and open their dialogs (the existing dialog tests keep finding them by
    name).
  - Summary and bundle row: the new labels, with today's values and edge cases.
  - Account, one test per state: password set and not set; Google connected, not connected and
    the only way in; recovery email set, none, and sent; demo. Each checks the exact words
    above, that "Logged in as" is gone, and that no text on the page says "sign in" outside
    Google's button.
  - The header's username link has the full name as `title`.
- **E2E:** no new tests ([e2e intent](intent/e2e-tests.md)); update any label the flip test
  names.
- **Screenshots:** a build (desktop and 375px) and Account in each state, light and dark.

## Boundaries

- **Always:** every icon-only control has a name and a matching `title`; meaning lives in
  visible words; one verb ("log in"); the brand's colours and focus ring.
- **Ask first:** a tooltip component or library; renaming anything in the API or the part
  form; new account features.
- **Never:** a tooltip as the only place something is explained; an icon without a name.

## Success Criteria

1. The build header shows two icon buttons, named and with tooltips, that open the same
   dialogs as before, at desktop and 375px.
2. Every icon-only control in the app has a tooltip; the truncated username shows in full on
   hover.
3. The summary and bundle row use the chosen labels, and specs/app.md uses them too.
4. The Account page reads as in Part 3 in every state, with no "sign in" outside Google's
   button and nothing said twice.
5. All tests pass (backend unchanged, frontend, e2e).
6. Checked on the live site after each part's deploy.

## Open Questions

None. Approved 2026-11-19 as written, with Part 2's proposed words and "Tied up" unchanged.
