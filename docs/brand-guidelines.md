# Brand Guidelines: PC Flipper Toolkit

Direction: **editorial ledger**. Calm, warm and deliberate, like a well-set annual report.
Ink on warm paper, one serif voice for names and the hero number, a quiet sans for everything else.

Figma: [PC Flipper Toolkit — v1 Screens](https://www.figma.com/design/Wp4dGW94gTWFjwZSha3nby), page **Brand v2 — Editorial ledger**
(tokens: `Brand v2` collection, text styles: `editorial/*`, effect: `editorial/focus-ring`).

## Principles

1. **One serif moment per screen.** Newsreader is for the build name, page titles, section titles and the profit hero. Nothing else.
2. **Color means money or action.** Green is the primary action and money made. Red is loss and delete. Everything else is ink, muted ink, or paper.
3. **Tables sit on the page.** Hairlines instead of cards. No shadows, no gradients. 4px corners on controls only.
4. **Numbers line up.** All amounts use tabular figures (`tabular-nums`) and are right-aligned in tables.

## Name & Logo

- **Wordmark:** `PC Flipper Toolkit` in Newsreader Medium 20, ink color. Never recolor it or set it in the sans.
- **Mark:** a serif `P` on a 4px-radius forest square (`accent` / `on-accent`). Used as the favicon and app icon.

## Color

Semantic tokens; each has a light and a dark value.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F5F2EC` | `#14130F` | Page background (warm paper) |
| `surface` | `#FFFDF9` | `#1C1A16` | Inputs, secondary buttons |
| `sunken` | `#EDE8DF` | `#24211C` | Inline edit row, hover |
| `line` | `#E2DCD0` | `#2E2B25` | Row hairlines |
| `line-strong` | `#CFC7B8` | `#3D3932` | Table head rules, input borders |
| `ink` | `#1D1B17` | `#EEEAE2` | Primary text |
| `muted` | `#6E685D` | `#A39D91` | Secondary text, labels, column heads |
| `faint` | `#A29B8E` | `#6D675D` | Placeholders, "—" |
| `accent` | `#1E5B43` | `#5FB58C` | Primary button, focus ring, mark |
| `on-accent` | `#FFFFFF` | `#0F1A14` | Text on accent |
| `profit` | `#1E6B45` | `#6CC497` | Positive money, "Sold" |
| `loss` | `#A63A2B` | `#E07A66` | Negative money, destructive actions |
| `status-building` | `#8A6100` | `#D9A441` | "Building" tag |
| `status-listed` | `#2F5D8A` | `#7FA8D6` | "Listed" tag |

"Planning" uses `muted`.

## Typography

| Style | Font | Size/Line | Use |
|---|---|---|---|
| `display-xl` | Newsreader Medium | 60/64, −1% | Profit hero only |
| `display` | Newsreader Medium | 40/44, −1% | Build name, page title |
| `display-sm` | Newsreader Medium | 22/28 | Section titles (Parts, Extra costs, Summary) |
| `logo` | Newsreader Medium | 20/28 | Wordmark |
| `body` | Instrument Sans Regular | 15/22 | Default text, amounts |
| `body-strong` | Instrument Sans Medium | 15/22 | Part names, bought-for, totals, profit column |
| `button` | Instrument Sans Medium | 14/20 | Buttons |
| `small` | Instrument Sans Regular | 13/18 | Shop, meta lines |
| `small-strong` | Instrument Sans Medium | 13/18 | Labels, column heads, status tags |

Tailwind v4 `@theme`: `--font-serif: "Newsreader"`, `--font-sans: "Instrument Sans"` (Google Fonts).
Add `tabular-nums` to every element that shows money.

## Shape & Space

- Radius: `4px` on buttons, inputs, tags and the inline-edit row. Nothing else is rounded.
- Hairlines: rows use `line`, table heads and section tops use `line-strong`.
- Spacing: Tailwind's 4px scale. Sections are separated by 48px on desktop and 32px on mobile.
- No shadows, gradients or blur. Focus: 2px `accent` ring with a 2px offset.

## Components

Button (primary / secondary / danger), Status tag (outlined, 1px border in the status color), Field
(input / select), IconButton (edit / delete, needs `aria-label`), ProfitHero, BuildRow / BuildCard,
PartRow / PartCard, CostRow, SummaryItem. Parts and builds become stacked cards below 640px.

## Signature

- **Profit hero:** "Profit" label, then the amount in `display-xl` serif in `profit` or `loss`
  with the margin underneath. Shows "—" in `faint` until a selling price exists.
- **Build numbers:** builds are referred to as `Build 01` (id zero-padded to 2 digits) in meta lines,
  and as `01` in the list's No. column.

## Voice

Plain, calm, precise. Sentence case everywhere.
- Yes: "Add part", "No selling price yet", "Delete this build? Its 7 parts and 3 costs go with it."
- No: "Oops!", "Awesome!", emoji, exclamation marks.

## Money

`₱12,500.00` via `Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })`.
Profit is always signed (`+₱3,700.00` / `−₱1,300.00`, using a true minus sign).
