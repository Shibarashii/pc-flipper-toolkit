// Each step's camera: how far in it goes at that step's clicks (specs/demo-video.md).
// The one file to edit to change a step; T71–T72 add the later steps and the captions.
import type { VideoEvent } from "./events.ts";

export const steps: Record<number, { zoom: number }> = {
  1: { zoom: 1.8 }, // Try the demo
  2: { zoom: 1.6 }, // the build's row
  3: { zoom: 1.6 }, // the new bundle's fields
  4: { zoom: 1.5 }, // the part form, wide, and the shop results under it
};

/** The step under way at time t (the last one that started), or 0 before the first. */
export function stepAt(t: number, events: VideoEvent[]): number {
  let step = 0;
  for (const e of events) if (e.type === "step" && e.t <= t) step = e.step;
  return step;
}

/** How far in the camera goes at time t, from that step's entry. */
export const zoomAt = (events: VideoEvent[]) => (t: number) =>
  steps[stepAt(t, events)]?.zoom ?? 1.6;
