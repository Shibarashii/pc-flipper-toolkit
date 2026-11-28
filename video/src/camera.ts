// Where the camera looks and how far in, at any frame (specs/demo-video.md).
// In viewport pixels: (x, y) is the point at the middle of the view, zoom 1 is the whole window.
import type { PointEvent, VideoEvent } from "./events.ts";

export type Camera = { x: number; y: number; zoom: number };

const W = 1280;
const H = 720;
const LEAD = 0.8; // seconds the camera starts moving in before a click
const LINGER = 0.6; // seconds it stays in after
const OMEGA = 7; // the spring's speed: settles in about 0.7 s, critically damped (no bounce)

const WHOLE: Camera = { x: W / 2, y: H / 2, zoom: 1 };

/** What the camera is heading for at time t: the nearest click around it, or the whole window. */
function target(t: number, clicks: PointEvent[], zoomFor: (t: number) => number): Camera {
  const near = clicks.filter((c) => c.t - LEAD <= t && t <= c.t + LINGER);
  if (near.length === 0) return WHOLE;
  const c = near.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
  return { x: c.x, y: c.y, zoom: zoomFor(c.t) };
}

/** Keeps the view inside the window: never past an edge, never below 1×. */
function clamp({ x, y, zoom }: Camera): Camera {
  const z = Math.max(1, zoom);
  const hw = W / (2 * z);
  const hh = H / (2 * z);
  return {
    x: Math.min(Math.max(x, hw), W - hw),
    y: Math.min(Math.max(y, hh), H - hh),
    zoom: z,
  };
}

// One simulation per event log and fps; each frame is looked up after that.
const cache = new WeakMap<VideoEvent[], Map<string, Camera[]>>();

/**
 * The camera at a frame: a critically damped spring following the target, so it eases in and
 * out and pans between clicks that are close together, never cutting.
 */
export function cameraAt(
  frame: number,
  events: VideoEvent[],
  fps: number,
  zoomFor: (t: number) => number,
): Camera {
  const key = String(fps);
  let byFps = cache.get(events);
  if (!byFps) cache.set(events, (byFps = new Map()));
  let frames = byFps.get(key);
  if (!frames) byFps.set(key, (frames = []));

  const clicks = events.filter((e): e is PointEvent => e.type === "click");
  const dt = 1 / fps;
  if (frames.length === 0) frames.push(WHOLE);
  // The velocity is recovered from the last two frames, so the cache needs only positions.
  while (frames.length <= frame) {
    const i = frames.length;
    const now = frames[i - 1];
    const before = frames[i - 2] ?? now;
    const goal = target(i * dt, clicks, zoomFor);
    const step = (p: keyof Camera) => {
      const v = (now[p] - before[p]) / dt;
      const a = OMEGA * OMEGA * (goal[p] - now[p]) - 2 * OMEGA * v;
      return now[p] + (v + a * dt) * dt;
    };
    frames.push({ x: step("x"), y: step("y"), zoom: step("zoom") });
  }
  return clamp(frames[Math.max(0, frame)]);
}
