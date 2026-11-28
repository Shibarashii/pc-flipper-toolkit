import { expect, test } from "vitest";
import { clicksBefore, cursorAt, type VideoEvent } from "./events.ts";

const events: VideoEvent[] = [
  { t: 0, type: "move", x: 100, y: 100 },
  { t: 1, type: "move", x: 300, y: 200 },
  { t: 1.5, type: "click", x: 300, y: 200 },
  { t: 3, type: "move", x: 500, y: 400 },
];

test("before the first event the cursor waits where it starts", () => {
  expect(cursorAt(-1, events)).toMatchObject({ x: 100, y: 100 });
});

test("between two logged points the cursor moves in a straight line", () => {
  expect(cursorAt(0.5, events)).toMatchObject({ x: 200, y: 150 });
});

test("on a click the cursor is exactly where it was logged", () => {
  expect(cursorAt(1.5, events)).toMatchObject({ x: 300, y: 200 });
});

test("after the last event the cursor stays at the last point", () => {
  expect(cursorAt(10, events)).toMatchObject({ x: 500, y: 400 });
});

test("only clicks at or before the time count", () => {
  expect(clicksBefore(1.4, events)).toEqual([]);
  expect(clicksBefore(1.5, events)).toEqual([events[2]]);
});
