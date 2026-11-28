// The recorder's event log, and where the drawn cursor is at any time (specs/demo-video.md).
// Positions are CSS pixels in the 1280×720 viewport; times are seconds from the video's start.

export type VideoEvent =
  | { t: number; type: "move" | "click"; x: number; y: number }
  | { t: number; type: "step"; step: number };

export type PointEvent = Extract<VideoEvent, { x: number }>;

export type EventLog = { duration: number; scale?: number; events: VideoEvent[] };

const points = (events: VideoEvent[]) =>
  events.filter((e): e is PointEvent => e.type !== "step");

/** The cursor at time t: a straight line between the logged points around it. */
export function cursorAt(t: number, events: VideoEvent[]): { x: number; y: number } {
  const ps = points(events);
  const next = ps.findIndex((p) => p.t > t);
  if (next === -1) return ps[ps.length - 1];
  if (next === 0) return ps[0];
  const a = ps[next - 1];
  const b = ps[next];
  const k = (t - a.t) / (b.t - a.t);
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

/** The clicks at or before time t, oldest first. */
export function clicksBefore(t: number, events: VideoEvent[]): PointEvent[] {
  return points(events).filter((e) => e.type === "click" && e.t <= t);
}
