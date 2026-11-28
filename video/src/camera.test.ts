import { expect, test } from "vitest";
import { cameraAt, type Camera } from "./camera.ts";
import type { VideoEvent } from "./events.ts";

const FPS = 30;
const W = 1280;
const H = 720;

// Clicks in the middle and in two corners, the worst case for showing past the edges.
const events: VideoEvent[] = [
  { t: 0, type: "move", x: 640, y: 360 },
  { t: 0.5, type: "step", step: 1 },
  { t: 2, type: "click", x: 640, y: 360 },
  { t: 5, type: "step", step: 2 },
  { t: 6, type: "click", x: 4, y: 4 },
  { t: 7, type: "click", x: 1276, y: 716 },
  { t: 12, type: "move", x: 640, y: 360 },
];
const zoomFor = () => 1.8;

const view = (c: Camera) => ({
  left: c.x - W / (2 * c.zoom),
  right: c.x + W / (2 * c.zoom),
  top: c.y - H / (2 * c.zoom),
  bottom: c.y + H / (2 * c.zoom),
});

test("the video starts on the whole window", () => {
  expect(cameraAt(0, events, FPS, zoomFor)).toEqual({ x: W / 2, y: H / 2, zoom: 1 });
});

test("the view never shows past the window's edges", () => {
  for (let frame = 0; frame <= 12 * FPS; frame++) {
    const v = view(cameraAt(frame, events, FPS, zoomFor));
    expect(v.left).toBeGreaterThanOrEqual(-1e-9);
    expect(v.top).toBeGreaterThanOrEqual(-1e-9);
    expect(v.right).toBeLessThanOrEqual(W + 1e-9);
    expect(v.bottom).toBeLessThanOrEqual(H + 1e-9);
  }
});

test("at a click the camera is in close, with the clicked point in view", () => {
  const c = cameraAt(2 * FPS, events, FPS, zoomFor);
  expect(c.zoom).toBeGreaterThan(1.6);
  const v = view(c);
  expect(640).toBeGreaterThan(v.left);
  expect(640).toBeLessThan(v.right);
});

test("a click in a corner stays in view, as close as the edges allow", () => {
  const v = view(cameraAt(6 * FPS, events, FPS, zoomFor));
  expect(v.left).toBeCloseTo(0, 0);
  expect(v.top).toBeCloseTo(0, 0);
});

test("between clicks far apart in time the camera is back out", () => {
  expect(cameraAt(4.5 * FPS, events, FPS, zoomFor).zoom).toBeLessThan(1.1);
});

test("the zoom never jumps from one frame to the next", () => {
  for (let frame = 1; frame <= 12 * FPS; frame++) {
    const a = cameraAt(frame - 1, events, FPS, zoomFor).zoom;
    const b = cameraAt(frame, events, FPS, zoomFor).zoom;
    expect(Math.abs(b - a)).toBeLessThan(0.08);
  }
});
