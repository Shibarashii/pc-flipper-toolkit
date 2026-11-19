# Designing in Figma

How to work in the design file. Read this before any Figma call. The look itself is in
[brand-guidelines.md](brand-guidelines.md); this page is how the file is organized and how to
build in it without redrawing what already exists.

- File: [PC Flipper Toolkit — v1 Screens](https://www.figma.com/design/Wp4dGW94gTWFjwZSha3nby),
  file key `Wp4dGW94gTWFjwZSha3nby`.
- Tools: call `create_session` with the file key first, load the `figma-use` skill before every
  `use_figma` call (and `figma-generate-design` when building a screen), and reuse the session id.

## Pages

The structure follows Figma's own guide to file organization
([team file organization](https://www.figma.com/best-practices/team-file-organization/)): one page
per stage of a design's life, with hyphen-only pages as separators. Keep the order.

| Page | Id | What goes there |
|---|---|---|
| Cover | `128:4975` | The 1920×960 cover frame (`129:1223`) and its "In this file" guide. Update the date and the guide when a page's purpose changes. |
| Discovery | `128:4976` | Explorations and options that weren't chosen, each section named with its outcome, e.g. "Logo — upside-down PC (decided)". |
| Flow — in review | `128:4977` | Designs waiting for approval, one section per flow, linked to their spec. **New designs start here.** |
| Prototype | `128:4978` | A click-through of the main path (Log in → Builds list → New build → Build detail → Account). Frames here are copies; link them with prototype reactions. |
| Brand identity | `126:1142` | The foundations: colors, type, logo, voice, in light and dark. Also holds `Logo/Mark` and `Logo/Wordmark`. |
| Local components | `128:4979` | Every component, in the sections Core components, App shell and Bundles. |
| Ready for development | `17:1142` | Approved screens only, one section per flow. Agents build code from this page. |

The life of a design: **Flow — in review** while its spec is written → the user approves the spec
and its wording → move the section to **Ready for development** and change its note → the user
marks the section *Ready for dev* in Dev Mode (the API can't). A design that's dropped goes to
**Discovery** with its outcome in the section name, or is deleted if the user says so.

## Tokens: use only these

- Colors: the **`Brand v2`** variable collection (`VariableCollectionId:17:1143`), modes
  Light `17:0` and Dark `17:1`. Variables: `bg`, `surface`, `sunken`, `line`, `line-strong`,
  `ink`, `muted`, `faint`, `accent`, `accent-hover`, `on-accent`, `profit`, `loss`,
  `status-building`, `status-listed`, `scrim`, `slot-fill`.
- Text: the **`editorial/*`** text styles (`display-xl`, `display`, `display-sm`, `logo`, `body`,
  `body-strong`, `button`, `small`, `small-strong`).
- Focus: the **`editorial/focus-ring`** effect style.

Every fill and stroke is bound to a `Brand v2` variable (`figma.variables.setBoundVariableForPaint`),
never a hex value, so the dark copy of a screen works by switching the mode.

These are the file's only variables and styles; the explorations from before the brand was chosen
were deleted on 2026-11-17. Don't add another collection or style set: extend these.

## Components

All on Local components. Place instances (`component.createInstance()`, or a variant from the set
with `set.children.find(v => v.name === "session=in, size=desktop")`) and set their properties with
`setProperties`. Don't detach instances and don't rebuild something that's in this table.

| Component | Id | Properties |
|---|---|---|
| Header | `124:5783` | `session` in / demo / out, `size` desktop / mobile, `Username` text |
| Footer | `124:5808` | `size` desktop / mobile |
| ThemeToggle | `124:5702` | `theme` light / dark (already inside Header) |
| Logo/Mark | `17:1169` | none. 28px in the header. See the gotcha below for other sizes. |
| Logo/Wordmark | `17:1167` | none |
| Button | `17:1264` | `variant` primary / secondary / danger, `state` default / hover / focus / disabled, `Label` |
| Field | `29:2282` | `state` default / focus / disabled, `Label`, `Value`, `Show label`, `Select`, `Error`, `Error text` |
| Textarea | `20:1071` | `Value` |
| IconButton | `17:1282` | `action` edit / delete / listing, `size` row (28px, ghost) / header (38px, bordered; listing and delete only), `state` default / hover / focus |
| Status | `17:1273` | `status` planning / building / listed / sold |
| ProfitHero | `17:1289` | `Value`, `Caption` |
| BuildRow / BuildCard | `17:1293` / `17:1302` | name, cost, selling, profit texts (row also `No.`) |
| PartRow / PartCard | `17:1317` / `17:1333` | name, shop/meta, category, listed, bought-for texts |
| CostRow | `17:1354` | `Label`, `Amount` |
| SummaryItem | `17:1366` | `Label`, `Value` |
| BundleRow / BundleCard | `77:4635` / `77:4655` | name, meta, listed total, price, not assigned, `Show not assigned` |
| DiagramSlot, BuildDiagram, SlotRow | `23:1840`, `23:1841`, `23:1880` | `state` filled / missing / optional, labels |

Text property keys carry a suffix (`Label#17:0`); read them from
`componentPropertyDefinitions` rather than guessing.

A new component is fine when nothing above fits: build it on Local components in the right
section, from `Brand v2` variables and `editorial/*` styles, and give it a description that names
its code file. **Ask the user before changing an existing main component**: every screen uses it.

## Building a screen

The code is the reference for layout. Before drawing, read the page in `frontend/src/pages/`,
the shell in `frontend/src/App.tsx` and the classes in `frontend/src/ui.ts`, and copy their sizes.

- **Frame:** Desktop 1280 wide, Mobile 375 wide; at least 800 / 812 tall. Vertical auto-layout,
  no padding or gap, items centered, fill bound to `bg`.
- **Children, in order:** a `Header` instance, a `Main` frame, a `Spacer (flex-1)` frame with
  `layoutGrow = 1` when the content is shorter than the frame, then a `Footer` instance.
- **Main** mirrors the page's `<main>`: width = the page's `max-w` + 32 (its `px-4`), padding
  16 at the sides, 80 top on desktop (`sm:pt-20`) and 48 on mobile (`pt-12`), bottom as in the code;
  on mobile it fills the width. Example: Log in is `max-w-[400px]`, so Main is 432 wide.
- **Dark:** duplicate the light frame and call
  `frame.setExplicitVariableModeForCollection(collection, "17:1")`. Nothing else changes.
- **Names:** `<Screen> · <State> — <Desktop|Mobile> · <Light|Dark>`, e.g.
  `Account — Mobile · Dark`, `Recovery pages · States — Desktop · Light`.
- **Sections:** one per flow. A note text at the top (x 120, y 60, 1400 wide) saying the stage,
  the spec it belongs to, and what's in it. Frames from y 168: the light row, then the dark row
  below it; frames in a row 80 apart, desktop before mobile, defaults before states.
- **Words:** from the spec or the existing code. Never invent copy silently; if a screen needs a
  sentence the spec doesn't have, write it and list it for the user to approve.

## Before you finish

- Screenshot every frame you touched, light and dark, and look at them.
- Check that nothing has a hard-coded color: no fill or stroke without a bound variable.
- Update the Cover's "Updated" date, and the prototype if the main path changed.
- Tell the user what to do by hand: mark sections Ready for dev, or set the Cover as the thumbnail.

## API gotchas

- `figma.setCurrentPageAsync` works once per `use_figma` call, and `figma.loadAllPagesAsync` isn't
  supported: work on one page per call.
- Resizing a `Logo/Mark` instance leaves its vector at 32px. Make a new instance and call
  `instance.rescale(size / 32)`.
- `node.devStatus` and `figma.setFileThumbnailNodeAsync` aren't supported: ask the user.
- A prototype link can't go from a frame to itself.
- `findAll` may miss nodes created earlier in the same call; look them up in the next call.
- `setRangeTextStyleId` fails on a range past the text's end: compute it with `indexOf`.
