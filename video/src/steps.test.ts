import { expect, test } from "vitest";
import type { VideoEvent } from "./events.ts";
import { captionAt, steps } from "./steps.ts";

const events: VideoEvent[] = [
  { t: 0, type: "step", step: 1 },
  { t: 3, type: "step", step: 2 },
  { t: 6, type: "move", x: 0, y: 0 },
];

test("each step shows its own caption", () => {
  expect(captionAt(1.5, events).text).toBe(steps[1].caption);
  expect(captionAt(4.5, events).text).toBe(steps[2].caption);
});

test("a caption is fully shown in the middle of its step", () => {
  expect(captionAt(1.5, events).opacity).toBe(1);
});

test("captions fade out and in where the steps meet, never cutting", () => {
  expect(captionAt(2.99, events).opacity).toBeLessThan(0.1);
  expect(captionAt(3.01, events).opacity).toBeLessThan(0.1);
  expect(captionAt(2.85, events).opacity).toBeGreaterThan(0.3);
});

test("the first caption is there from the first frame", () => {
  expect(captionAt(0, events).opacity).toBe(1);
});

test("every step of the video has a caption", () => {
  for (const step of [1, 2, 3, 4, 5, 6, 7]) expect(steps[step].caption).toBeTruthy();
});
