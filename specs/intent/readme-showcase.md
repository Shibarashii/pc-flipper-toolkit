# Intent: a README that shows the app off; setup goes to `docs/`

Confirmed by the author on 2026-11-21 (interview-me), after looking at
[PhotoCraft's README](https://github.com/storytold/photocraft).

- **Outcome:** the README is a showcase in PhotoCraft's style, its main elements only:
  - centred logo (light and dark), name, a one-line pitch, a few badges, and links to the
    live app and Try the demo;
  - a large screenshot of the build page with the demo's sold build, with a caption;
  - a row of section links;
  - `## Features`: six screenshots, two per row, each with a caption, a heading and a short
    paragraph (the build page, the profit summary, the builds list, price lookup, copy the
    listing, light and dark);
  - a short ending: built with, links to the docs, the license.
- **`docs/`** is for anyone reading or using the project (people who clone, run or deploy it
  count), not for how we build it, which stays in `specs/`. Getting started (with known
  limits), testing and deployment move there from the README; the screenshots go in
  `docs/images/`.
- **User:** recruiters, other flippers and developers landing on the GitHub repo.
- **Why now:** the README read as a developer manual; it should sell the app first.
- **Success:** the README's first screen shows what the app does and a picture of it; every
  feature has a fresh screenshot from a demo account; every setup step still exists, one
  click away in `docs/`.
- **Constraint:** real screenshots, taken by a script so they can be retaken, with nothing
  personal; words follow the landing page; PhotoCraft's main elements, not its details.
- **Out of scope:** PhotoCraft's four-column highlights table, Discord-style banners and its
  sections after Features; changes to the app; a docs website; rewriting `specs/`.
