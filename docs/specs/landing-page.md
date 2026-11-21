# Spec: Landing page and search fixes

A public home page and the search fixes found on the live site, on top of
[SPEC.md](../../SPEC.md), which stays the source of truth for everything else. Intent
confirmed in conversation on 2026-11-21. Replaces two backlog entries ("A landing page",
"SEO fixes").

## Objective

- **What:** logged-out visitors to `/` see a landing page instead of the log-in form. Its first
  screen says what the app does in one line, shows the build page's PC diagram with price tags
  and the profit, and offers **Try the demo**. Below it: the build page, what it tracks, how
  profit is worked out, and four questions. Around it, each public page names itself to Google,
  private pages ask not to be indexed, unknown URLs return a real 404, and a sitemap lists the
  public pages.
- **Why:** searching "pc flipper toolkit" finds neither the site nor the GitHub repo. A crawler
  at `/` only sees a log-in form, every URL claims to be `/`, and every URL returns 200.
- **Users:** people the author sends the link to (they should get it in 10 seconds without
  scrolling), and PC flippers arriving from Google or an AI Overview.
- **Stays:** the name "PC Flipper Toolkit" and the address `pc-flipper-toolkit.vercel.app`.

### User stories

1. Logged out, I open the site and see in one screen what it does, a picture of it, and a
   **Try the demo** button that logs me into the demo, as on the log-in page.
2. A returning user on the landing page finds **Log in** in the header.
3. Logged in, `/` is still my builds list.
4. I search Google for "pc flipper toolkit" and the site is a result, described in the
   page's own words (the hope, not the test: "track profit flipping pcs" finds it later).
5. A browser tab and a search result show the page's own title ("Privacy · PC Flipper Toolkit").
6. A mistyped URL (`/sitemap`, `/anything`) gets a "Page not found" with a link home, and
   status 404.

### Out of scope

- A rename or a domain of our own (both parked together in the backlog).
- Server rendering or prerendering. Google runs the JavaScript; link previewers don't, so the
  share card stays one card for every URL, as in [share-card.md](share-card.md).
- A blog, more pages to rank, FAQ rich results (`FAQPage` results are limited to government
  and health sites), and posting the link anywhere. Links from elsewhere are the author's.

## Part 1: Search fixes (no landing page needed)

### Which pages are indexed

| Path | Title | Indexed |
|---|---|---|
| `/` logged out | `PC Flipper Toolkit · Track your profit on every PC you flip` | yes, canonical `/` |
| `/` logged in | `Builds · PC Flipper Toolkit` | (Google is never logged in) |
| `/builds/:id` | `<build name> · PC Flipper Toolkit` | no |
| `/privacy` | `Privacy · PC Flipper Toolkit` | yes, canonical `/privacy` |
| `/login`, `/signup` | `Log in · …`, `Sign up · …` | no |
| `/account`, `/forgot`, `/reset-password`, `/verify-email` | `Account · …`, `Forgot password · …`, `Reset password · …`, `Verify email · …` | no |

- **Titles** use React 19's `<title>` in each page component, which React hoists into
  `<head>`. `index.html` keeps `<title>PC Flipper Toolkit</title>` for the first paint.
- **Canonicals:** the static `<link rel="canonical">` leaves `index.html`. The landing page
  and Privacy render their own (`<link rel="canonical" href={`${SITE_URL}/privacy`} />`).
  Google asks for one canonical, not one in the HTML and a different one added by JavaScript.
  Vercel's preview URLs are already `noindex` (Vercel's own header), so the old reason for
  "everything points to `/`" is gone. `og:url` stays `/` (previewers don't run JavaScript).
- **`noindex`** comes from a `vercel.json` header, `X-Robots-Tag: noindex`, on
  `/(login|signup|account|forgot|reset-password|verify-email)` and `/builds/(.*)`. That's
  more reliable than a meta tag added by JavaScript, and log-in pages don't compete with `/`
  for the name search.

### Real 404s

`vercel.json` stops rewriting every path to `index.html`. It rewrites only the app's routes
(`/`, `/login`, `/signup`, `/privacy`, `/account`, `/forgot`, `/reset-password`,
`/verify-email`, `/builds/:id`). Files in `public/` are served first as before, including
`google0717eefd8353a321.html`, which must stay. Everything else gets Vercel's 404 status with
`public/404.html`, styled with `public/404.css` (the brand's paper, ink and fonts; light or dark
from the browser's setting, as there's no theme button; no inline styles, which the CSP
forbids). It has the header's logo and name (a link home), then:

- **Heading:** Page not found
- **Line:** There’s nothing at this address. Check the link, or start from the home page.
- **Go to the home page** (primary button, a link to `/`)

### Sitemap, robots, site name

- `public/sitemap.xml` lists `/` and `/privacy`. `robots.txt` gets
  `Sitemap: https://pc-flipper-toolkit.vercel.app/sitemap.xml`.
- `index.html` gets `WebSite` structured data, which Google uses for the site name in
  results:
  ```html
  <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"WebSite","name":"PC Flipper Toolkit","url":"https://pc-flipper-toolkit.vercel.app/"}
  </script>
  ```
  It's data, not a script, so the CSP doesn't block it and it needs no hash.

### The site's address, once

`frontend/src/site.ts` exports `SITE_URL = "https://pc-flipper-toolkit.vercel.app"` for the
canonicals. The static files can't import it (`index.html`'s `og:*` tags and structured data,
`sitemap.xml`, `robots.txt`), so a test fails if any absolute URL in them uses another
origin. Moving to a domain later means changing the constant, and the test lists the rest.
(ponytail: no build step that writes the URL into static files; add one if the address ever
changes often.)

### GitHub and Search Console (the author's part, no code)

- **The repo:** its description becomes the meta description's line ("For people who flip PCs.
  Log each part…"), with `pc-flipper`, `profit-tracker` and `pc-building` added to its topics.
  Changed with `gh repo edit` once the author says yes.
- **Search Console**, after the deploy: submit `sitemap.xml`, inspect `/` and press **Request
  indexing**, then do the same for `/privacy`.

## Part 2: The landing page

`frontend/src/pages/Landing.tsx`, the logged-out route for `/`. Other logged-out paths still
redirect to `/login` and remember where they were going. Design: direction A, "the PC diagram as
the hero", approved with its words on 2026-11-21 (Figma, **Ready for development**, section
"Landing page").

**No screenshots.** Both pictures are the app's own components (`BuildChecklist`'s diagram,
`Summary`, `StatusTag`, the cost rows) rendered from fixed data in `src/landingDemo.ts`: the
demo's sold build (Ryzen 5 5600 + RX 6600; parts ₱27,300, extra costs ₱500, sold for ₱32,000,
profit ₱4,200, 13.13% margin). They follow the theme on their own, stay sharp, and their text is
readable by Google. They're pictures, not controls: each sits in an `inert` wrapper, so nothing
in them can be clicked or focused. The diagram moves out of `BuildChecklist` into its own
`BuildDiagram` so the hero can use it alone.

### Hero (the first screen at 1280×720; on a phone, through the buttons)

- **Label:** For people who flip PCs (small, accent)
- **Heading** (`h1`): Track your profit on every PC you flip (was "See the real profit…", changed 2026-11-21)
- **Line:** Log each part, bundle and extra cost. The app does the math.
- **Try the demo** (primary) and **Sign up** (secondary). Try the demo calls the same
  `tryDemo()` as the log-in page and shows the same error if it fails; then `/` becomes the
  builds list.
- **Under the buttons:** No sign-up needed. Deleted after 24 hours.
- **The picture,** to the right on desktop and under the text on phones: the build diagram, 1.3×
  on desktop. Hairlines with an accent dot run from three parts to price tags ("Board + CPU + RAM
  ₱9,500 bundle", "RX 6600 8GB ₱11,000", "650W PSU ₱2,400"; on phones only the first two, shorter
  and without lines), and a card with the profit (**+₱4,200.00**, "13.13% margin · sold for
  ₱32,000") overlaps the case's lower corner.
- **Header:** logged out and not on `/login` or `/signup`, a **Log in** button (secondary) sits
  beside the theme button (Figma: Header `session=landing`).
- **Height on desktop** (1280px and wider, added 2026-11-21): the hero fills the screen below the
  header, up to 960px, with its content centered as one block, so the next block starts below
  the first screen instead of peeking in. On a screen shorter than its content it keeps its
  own height; phones and tablets are unchanged. Intent:
  [landing-hero-height.md](../intent/landing-hero-height.md).

### Below the hero

Each block has its `h2` in the `display` style on desktop (`display-sm` on phones), 112px apart
on desktop and 72px on phones. No cards except the pictures; hairlines between questions.

1. **Every flip, part by part.** Line: "Each build shows its parts, what’s still missing, and the
   profit as it adds up." Then the build page's Build section and Summary with the demo's build,
   in a bordered `surface` panel cut off at 440px on desktop. Phones show only the Summary.
2. **What it tracks.** Three items, each a small picture on `sunken` above a name and one line:
   - **Parts**: a filled diagram slot "RX 6600 8GB", "Paid ₱11,000 · shop ₱13,000". "Shop price
     and what you paid. A bundle counts once."
   - **Extra costs**: two cost rows, Shipping ₱350.00 and Thermal paste ₱150.00. "Shipping,
     platform fees, thermal paste."
   - **Status**: the four status tags. "Planning, building, listed or sold: see where each PC is."
3. **How profit is worked out.** An equation in the serif: **₱32,000** "Sold for" − **₱27,800**
   "Parts ₱27,300 + extra costs ₱500" = **+₱4,200** (profit color) "Profit · 13.13% of the selling
   price". In a row on desktop, stacked on phones.
4. **Questions.** Four `<details>` rows (first one open), so the answers stay in the page for
   Google and AI Overviews while the page stays short:
   - *How do I track profit when flipping PCs?* Make a build for each PC, add every part with
     what you paid and the extra costs, then set the selling price. The app adds it up on each
     build and across all your builds.
   - *Is it free?* Yes.
   - *Can I try it without an account?* Yes. Try the demo gives you your own account with two
     sample builds to change as you like. It’s deleted after 24 hours.
   - *Where do the shop prices come from?* When you add a part, you can search current prices
     from EasyPC and PC Express, refreshed once a day, or type a price yourself.
5. **A closing band** on `sunken`, full width, centered: "Try it on two sample builds" (`h2`),
   "No sign-up needed. Your demo is deleted after 24 hours.", **Try the demo** and **Sign up**.

Each block below the hero, and the closing band, fades in (from 16px lower) as it scrolls into
view, once. Every block is in the HTML from the start, so search engines read it all; with
reduce motion set, nothing moves (added 2026-11-21).

Then the footer, as on every page.

## Commands

Same as [SPEC.md](../../SPEC.md#commands): `npm test`, `npm run lint`, `npx tsc -b` and
`npm run e2e` in `frontend/`. After the deploy, check the live headers:
`curl -sI https://pc-flipper-toolkit.vercel.app/anything | head -1` (404) and
`curl -sI https://pc-flipper-toolkit.vercel.app/login | grep -i x-robots` (noindex).

## Project Structure

```
frontend/vercel.json                 rewrites per route, X-Robots-Tag on private paths
frontend/index.html                  no canonical; WebSite structured data
frontend/public/404.html, 404.css    the not-found page
frontend/public/sitemap.xml          / and /privacy
frontend/public/robots.txt           + Sitemap line
frontend/src/site.ts                 SITE_URL
frontend/src/seo.test.ts             routes ↔ rewrites, one origin, titles
frontend/src/pages/Landing.tsx       the landing page (+ Landing.test.tsx)
frontend/src/landingDemo.ts          the demo's sold build, for the pictures
frontend/src/components/BuildDiagram.tsx  the case diagram, out of BuildChecklist
frontend/src/pages/*.tsx             a <title> each; canonical on Landing and Privacy
frontend/src/App.tsx                 logged-out "/" → Landing; header Log in
frontend/e2e/demo.spec.ts            starts the demo from the landing page
SPEC.md                              Screens: the landing page; Project Structure
```

## Code Style

A page names itself where it renders, with React's own `<title>`:

```tsx
export function Privacy() {
  return (
    <main className="…">
      <title>Privacy · PC Flipper Toolkit</title>
      <link rel="canonical" href={`${SITE_URL}/privacy`} />
      …
    </main>
  );
}
```

## Testing Strategy

- **Vitest (`seo.test.ts`):** every `path="…"` in `App.tsx` (except `*`) matches a rewrite in
  `vercel.json`, so a new page can't 404 in production; every absolute URL in `index.html`,
  `sitemap.xml` and `robots.txt` starts with `SITE_URL`; `index.html` has no canonical.
- **Vitest (pages):** the landing page has its heading, both buttons and the four questions;
  Try the demo starts a session and shows the same error as the log-in page when it fails;
  logged out `/` shows Landing and `/builds/x` still redirects to `/login`; each page sets
  its title.
- **E2E:** `demo.spec.ts` starts from the landing page's **Try the demo** (no new test,
  [e2e intent](../intent/e2e-tests.md)).
- **Manual:** the landing page at 1280 and 375, light and dark, with the hero fitting at 1280×720;
  after the deploy, the two `curl` checks above and Search Console's URL inspection of `/`
  showing the landing page's text.

## Boundaries

- **Always:** keep `google0717eefd8353a321.html` served; use one origin everywhere; keep the
  share card as it is; keep the words as approved here.
- **Ask first:** a new dependency (no `react-helmet`, no prerender plugin); any page added to
  the sitemap; changing the repo on GitHub; anything that changes the address.
- **Never:** hidden text or keyword lists for crawlers; `noindex` on `/` or `/privacy`.

## Success Criteria

1. Logged out, `/` shows the landing page; at 1280×720 the hero (heading, buttons, diagram and
   profit card) fits without scrolling, in both themes; Try the demo opens the demo's builds.
2. Logged in, `/` is the builds list; logged-out deep links still go to `/login` and back.
3. On the live site: an unknown path returns 404 with the not-found page; `/login`, `/signup`,
   `/account`, `/forgot`, `/reset-password`, `/verify-email` and `/builds/…` send
   `X-Robots-Tag: noindex`; `/sitemap.xml` lists `/` and `/privacy`.
4. Each page's tab shows its own title; `/` and `/privacy` each carry their own canonical, and
   no page has two.
5. Search Console's URL inspection of `/` shows the landing page's text in the rendered HTML.
6. All tests pass. Showing up for "pc flipper toolkit" in Google is checked 1–2 weeks after
   the indexing request; it's what this is for, but Google decides when.

## Open Questions

Approved by the author on 2026-11-21, with the words and the one-address approach as written.
Design first. A first draft was dropped as too plain and too wordy (now on Discovery); three
first screens were compared there and direction A was picked on 2026-11-21. The landing page (A)
and the 404 page, with their words, were approved on 2026-11-21 and are on **Ready for
development** in Figma, section "Landing page" (`175:3`), light and dark, 1280 and 375. The design added a
`session=landing` variant to the Header component.

1. **Search Console now:** what does URL inspection say about `/` today ("URL is not on
   Google", "Crawled – currently not indexed"…)? It tells us whether Google has seen the site
   at all. Not blocking.
