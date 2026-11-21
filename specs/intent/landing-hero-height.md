# Intent: the landing page's hero fills the first screen on desktop

Confirmed by the author on 2026-11-21 (interview-me).

- **Outcome:** on desktop, the hero fills the first screen below the header, its content
  centered vertically; "Every flip, part by part" starts just below the fold instead of
  peeking in.
- **User:** a visitor landing on `/` on a desktop or laptop.
- **Why now:** on taller screens (e.g. 1875×935) the next block's heading shows half-way into
  the first screen, which looks unfinished.
- **Success:** at 1875×935 the first screen shows only the header and the hero, with even
  space above and below; at 1280×720 it looks as it does now; on very tall screens the hero
  stops growing at a cap, so the content doesn't float in a big empty area.
- **Constraint:** on a screen shorter than the content, the hero keeps its natural height,
  never cut. Words, picture and design unchanged; only its height and vertical position.
- **Out of scope:** phones and tablets; the blocks below the hero (no full-screen sections,
  no scroll-snapping); the fade-in; the share card image.
