// The video's beats, in order (specs/showcase-video.md, "Beats"). A beat that needs more
// room for the voice grows here, and every later beat moves with it.
export const FPS = 30;

export const BEATS = [
  { id: "hook", frames: 150, caption: "What did your last flip really make you?" },
  { id: "parts", frames: 450, caption: "Log every part, bundle and cost" },
  { id: "prices", frames: 270, caption: "Check today’s shop prices" },
  { id: "profit", frames: 270, caption: "Know your profit, to the peso" },
  { id: "listing", frames: 150, caption: "Post the listing in one tap" },
  { id: "builds", frames: 150, caption: "Every flip, every month" },
  { id: "stack", frames: 210, caption: "Built from scratch by Seanrei Valdeabella" },
  { id: "end", frames: 150, caption: "Track your profit on every PC you flip" },
] as const;

export const TOTAL_FRAMES = BEATS.reduce((sum, b) => sum + b.frames, 0);
