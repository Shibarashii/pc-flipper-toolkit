# Spec: Copy listing

A separate feature on top of [SPEC.md](../../SPEC.md), which stays the source of truth for
everything else (stack, auth, money rules, code style). Agreed in conversation on 2026-11-06
(see [the backlog](../ideas/backlog.md)).

## Objective

When a build is done, I click **Copy listing** on its page and get a ready-to-paste Facebook
Marketplace post: the build's name, its parts by slot, and its price. I can edit the text,
then copy it in one click and paste it into Marketplace.

- **User:** a flipper about to post a finished build. Demo accounts get it too.
- **Why:** the app helps until the build is done, then stops. Writing the post is the one job
  a flipper repeats on every flip, and the app already knows everything in it.

### The post

Plain text, built from what the app already knows. For the demo's sold build, before parts
had a condition:

```
Ryzen 5 5600 + RX 6600

CPU: Ryzen 5 5600
Motherboard: MSI B550M Pro-VDH
RAM: 16GB DDR4 3200
Storage: 1TB NVMe SSD
GPU: RX 6600 8GB
PSU: 650W 80+ Bronze
Case: Tecware Nexus Air

Price: ₱32,000
```

- **First line:** the build's name, then a blank line.
- **Parts:** one line per slot, `Label: name`, in the checklist's order: CPU, Motherboard,
  Cooler, RAM, Storage, GPU, PSU, Case, then Other. The labels are the app's category names.
  - An empty slot is left out (no "Cooler: none").
  - Several parts in one slot share its line. The same name twice becomes `2× name`; different
    names are joined with ` + `, e.g. `Storage: 1TB NVMe SSD + 2TB HDD`.
  - Parts in a bundle are listed like any other part; the bundle itself isn't mentioned.
  - A part's condition, when set, follows its name in brackets: `RX 6600 8GB (Used – Like
    New)`. Added later by [part condition](part-condition.md).
- **Price:** after a blank line, `Price: ₱32,000`. Whole pesos have no centavos (₱32,000);
  otherwise they're shown (₱32,000.50). With no selling price, the price line and its blank
  line are left out.
- **Never in the post:** what was paid (bought-for, bundle prices), listed prices, shops, extra
  costs, profit, status, notes. Notes often hold private details, like the buyer's town.
- A build with no parts gives just its name (and price).

### User stories

1. On a finished build, Copy listing opens a dialog with the post above, ready to copy.
2. I edit the text (add "Tested, with box. Meetup in QC."), press Copy, and paste exactly what
   I edited.
3. Closing and opening the dialog again starts from the generated post: edits aren't saved.
4. If the browser won't let the app copy, the text is selected and I'm told to press Ctrl+C
   (or use the phone's Copy).
5. It works on a phone (375px) without horizontal scrolling.

### Out of scope (this version)

- Tracking the sale, photos, posting to
  Facebook directly, other marketplaces' formats, emojis.
- Saving edits, templates, or a default pitch line.
- Any API or data model change. The post is made from the build the page has already loaded.

## Screens

**Build page header** (`frontend/src/components/BuildHeader.tsx`). A **Copy listing** button
(secondary style) sits beside **Delete build**, on the same line on desktop and below the fields
on phones.

**Copy listing dialog** (a new `ListingDialog`, built like `NewBuildDialog`: a native
`<dialog>` opened with the existing `useModal()`):

- Title "Copy listing", and a short muted line: "For Facebook Marketplace. Edits here aren't
  saved."
- A text box (`<textarea>`, labelled "Listing") holding the post, tall enough to show it
  without scrolling for a typical build (about 14 lines), full width, resizable vertically.
- Buttons: **Close** (secondary) and **Copy** (primary, the dialog's main action). Copy has
  the focus when the dialog opens, so Enter copies straight away.
- **Copy** writes the text box's current text with `navigator.clipboard.writeText`. Then a
  status line (`role="status"`) says "Copied". The dialog stays open, so it can be copied
  again.
- **If copying fails** (no clipboard permission, or an insecure page): the text box's text is
  selected and the status line says "Couldn't copy. The text is selected: press Ctrl+C, or
  use your phone's Copy."
- Esc and Close close it, like the other dialogs. Each open starts from a freshly made post,
  from the build as it is now (e.g. after changing the selling price).
- Brand: `surface` background, `line-strong` border, no shadow; green only on Copy.

## Code

- **`frontend/src/listing.ts`:** `listingText(build: BuildDetail): string`, a pure function
  that makes the post. The slots, their labels and order come from the checklist's
  `buildSlots()` in `slots.ts`, so the two never disagree; "Other" parts go last. The price
  uses the same `en-PH` peso format as `money.ts`, without `.00` on whole pesos.
- **`frontend/src/components/ListingDialog.tsx`:** the dialog above.
- **`frontend/src/components/BuildHeader.tsx`:** the button, and the dialog while open.

No backend change, no new dependency.

## Commands

Same as [SPEC.md](../../SPEC.md#commands): `npm test`, `npm run lint` and `npx tsc -b` in
`frontend/`.

## Project Structure

```
frontend/src/
  listing.ts                       listingText(), the post
  listing.test.ts
  components/ListingDialog.tsx     the dialog
  components/ListingDialog.test.tsx
  components/BuildHeader.tsx       the Copy listing button
```

## Testing Strategy

- **`listing.test.ts`:** the demo's sold build gives exactly the post above; slot order with an
  Other part last; an empty slot left out; `2×` for the same name and ` + ` for different ones;
  a bundle's parts listed; no price line without a selling price; ₱32,000 vs ₱32,000.50; and
  none of bought-for, listed prices, shops, extra costs or notes appear (a build with all of
  them set).
- **`ListingDialog.test.tsx`** (with `navigator.clipboard` stubbed): opens with the post and
  Copy focused; an edited text is what gets copied; "Copied" appears; a failed copy selects the
  text and shows the Ctrl+C message; Close, then opening again, starts from the generated post.
- **Manual:** on a phone and on desktop, copy a listing and paste it into a new Facebook
  Marketplace post (or any text box). Real clipboards differ from the test stub.

## Boundaries

- **Always:** make the post only from data the page has; leave out anything about what was
  paid, the profit, shops and notes.
- **Ask first:** saving edits or templates; adding photos or other marketplaces;
  any API change.
- **Never:** put costs, profit, shops or notes in the post; post to Facebook on the user's
  behalf.

## Success Criteria

1. On the live demo's sold build, Copy listing then Copy, pasted into a text box, gives exactly
   the post above.
2. An edit made in the dialog is what gets pasted, and reopening the dialog shows the generated
   post again.
3. Frontend tests prove every rule in [The post](#the-post), including that no cost, profit,
   shop or note ever appears, and all tests pass.
4. The dialog is usable at 375px without horizontal scrolling, and Copy works on a phone.

## Open Questions

None. Decided 2026-11-07: a dialog from the header, and plain `Label: name` lines.
