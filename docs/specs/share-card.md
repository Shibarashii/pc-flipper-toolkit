# Spec: Share card and search tags

A link preview and search snippet for the site, on top of [SPEC.md](../../SPEC.md), which
stays the source of truth for everything else. Intent confirmed in conversation on
2026-11-12.

## Objective

- **What:** when a link to `https://pc-flipper-toolkit.vercel.app` is pasted on LinkedIn,
  Facebook or Messenger, it shows a large card: the name, one line about the app, and a
  1200×630 picture of the builds list. Googling "PC Flipper Toolkit" shows the same name and
  line.
- **Why:** the site is live and verified in Google Search Console (2026-11-12), but a shared
  link is a bare URL, which undersells it.
- **Users:** people who know the author (friends, other flippers, a recruiter on LinkedIn).
  The card should make them tap through and press **Try the demo**.

### User stories

1. I paste the site's link in a Messenger chat or a LinkedIn or Facebook post, and a large
   card appears with "PC Flipper Toolkit", a line saying what it does and that the demo needs
   no sign-up, and a picture of the builds list.
2. I search Google for "PC Flipper Toolkit", and the result shows that name and the same line,
   not text scraped from the log-in form.

### Out of scope

- Different tags per page. Link previewers don't run JavaScript, so every URL gets the
  `index.html` head; per-page tags would need server rendering.
- A public landing page, or content to rank for generic searches ("PC flipping profit
  calculator").
- A sitemap (one page to index), an X/Twitter card (one line if it's ever needed), a
  Facebook app id.

## Frontend

### Tags (`frontend/index.html`, in `<head>`, after `<title>`)

```html
<meta name="description" content="Track the profit on every PC you flip: parts, extra costs, selling price and true profit. Try the demo, no sign-up needed." />
<link rel="canonical" href="https://pc-flipper-toolkit.vercel.app/" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="PC Flipper Toolkit" />
<meta property="og:title" content="PC Flipper Toolkit" />
<meta property="og:description" content="(the same line as the description)" />
<meta property="og:url" content="https://pc-flipper-toolkit.vercel.app/" />
<meta property="og:image" content="https://pc-flipper-toolkit.vercel.app/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="The builds list: each PC build with its status, cost, selling price and profit" />
```

- **The line** is under 155 characters, so Google doesn't cut it, and it ends on "Try the
  demo, no sign-up needed." because that's the action the card is for.
- **URLs are absolute.** Facebook and LinkedIn don't resolve relative ones.
- **Canonical and `og:url` point to the home page on every URL.** Only the home page (the
  log-in page when logged out) needs to be found. This also stops Vercel's preview URLs from
  being indexed as copies of the site.
- These are plain tags: the CSP in `vercel.json` doesn't apply to them, and the crawler's
  fetch of the image isn't the page's.

### Image (`frontend/public/og-image.png`)

- 1200×630 PNG, under 1 MB (LinkedIn and Facebook both accept it; Messenger uses Facebook's
  copy).
- A fresh screenshot, not the README's (that one is from 2026-10-27, before the summary, the
  header logo and the row inset): the builds list of a demo account, light theme, taken at a
  1200×630 viewport, so nothing needs cropping or scaling.
- The demo's two sample builds and the summary are visible; nothing personal (a demo
  username like `demo-…` in the header is fine).

### `frontend/public/robots.txt`

```
User-agent: *
Allow: /
```

Vercel serves files in `public/` before the catch-all rewrite to `index.html`, as it already
does for the Search Console file.

## Commands

Same as [SPEC.md](../../SPEC.md#commands): `npm test`, `npm run lint` and `npm run build` in
`frontend/`. No backend change.

On the live site, after the deploy:

```
curl -s https://pc-flipper-toolkit.vercel.app/ | grep -E 'og:|description|canonical'
curl -sI https://pc-flipper-toolkit.vercel.app/og-image.png   # 200, image/png
curl -s https://pc-flipper-toolkit.vercel.app/robots.txt
```

## Project Structure

```
frontend/index.html          + the tags
frontend/public/og-image.png the card's picture (new)
frontend/public/robots.txt   (new)
frontend/src/csp.test.ts     + one test that the tags and the image are there
```

## Testing Strategy

- **Unit (Vitest, in `csp.test.ts`, which already reads `index.html` in Node):** one test
  that `index.html` has the description, canonical and each `og:` tag above, that
  `og:image` is an absolute URL to `/og-image.png`, and that `public/og-image.png` exists
  and is 1200×630 (read from the PNG header, no new dependency).
- **No e2e:** link previews are made by the platforms' crawlers, not a browser.
- **Live (by the author, after the deploy):** Facebook's Sharing Debugger
  (`developers.facebook.com/tools/debug`, "Scrape Again" if it cached the bare link) and
  LinkedIn's Post Inspector (`linkedin.com/post-inspector`), then a real paste in Messenger.

## Boundaries

- **Always:** absolute URLs; the description and `og:description` say the same thing; the
  image stays 1200×630.
- **Ask first:** per-page tags or server rendering, a landing page, analytics or tracking
  pixels, changing the line's wording after approval.
- **Never:** a Facebook pixel or any third-party script for this; personal data in the image.

## Success Criteria

1. Facebook's Sharing Debugger shows the large card for the home page with the title, the
   line and the image, and no missing-property warnings other than `fb:app_id`.
2. LinkedIn's Post Inspector shows the same title, line and image.
3. A link pasted in Messenger shows the card. (2026-11-12: Messenger on the web shows every
   link as its bare domain in the author's chat, GitHub's too, so this depends on Messenger,
   not the site.)
4. `robots.txt` and `og-image.png` are served on the live site (200), and the home page's
   HTML has the tags.
5. All tests pass (frontend, e2e).

## Open Questions

None. Decided 2026-11-12: Open Graph tags, a description and canonical, `robots.txt`, and a
1200×630 picture of the builds list; for people who know the author, pointing them to the
demo. Taken as a fresh screenshot rather than the README's older one.
