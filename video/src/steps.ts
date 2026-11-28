// Each step's caption and camera (specs/demo-video.md#steps): the one file to edit to change
// a step. Step 7 is the end card, after the recording.
import type { VideoEvent } from "./events.ts";

export const steps: Record<number, { caption: string; zoom: number }> = {
  1: { caption: "Flip PCs? Know what each one really made you.", zoom: 1.8 }, // Try the demo
  2: { caption: "Every flip in one place", zoom: 1.6 }, // the build's row
  3: { caption: "Bought a bundle? Log it as one price.", zoom: 1.6 }, // the bundle's fields
  4: { caption: "Check today's shop prices", zoom: 1.5 }, // the part form and its shop results
  5: { caption: "Know your profit, to the peso", zoom: 1.7 }, // the selling price, the profit
  6: { caption: "Post the listing in one tap", zoom: 1.4 }, // the listing dialog
  7: { caption: "Track your profit on every PC you flip", zoom: 1 }, // the end card
};

const FADE = 0.3; // seconds each side of a change of step

/** The step under way at time t (the last one that started), or 0 before the first. */
export function stepAt(t: number, events: VideoEvent[]): number {
  let step = 0;
  for (const e of events) if (e.type === "step" && e.t <= t) step = e.step;
  return step;
}

/** How far in the camera goes at time t, from that step's entry. */
export const zoomAt = (events: VideoEvent[]) => (t: number) =>
  steps[stepAt(t, events)]?.zoom ?? 1.6;

/** The caption at time t, fading out just before its step ends and in just after the next
 * starts, so the words change while they're invisible. */
export function captionAt(t: number, events: VideoEvent[]): { text: string; opacity: number } {
  const starts = events.filter((e) => e.type === "step").map((e) => e.t);
  const step = stepAt(t, events);
  const start = starts.filter((s) => s <= t).at(-1) ?? 0;
  const next = starts.find((s) => s > t) ?? Infinity;
  const fadeIn = start === starts[0] ? 1 : (t - start) / FADE;
  const fadeOut = (next - t) / FADE;
  return {
    text: steps[step]?.caption ?? "",
    opacity: Math.max(0, Math.min(1, fadeIn, fadeOut)),
  };
}
