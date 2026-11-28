import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clicksBefore, cursorAt, type VideoEvent } from "./events.ts";
import { color } from "./theme.ts";

const SIZE = 36; // viewport px, about twice a normal cursor (specs/demo-video.md)
const RIPPLE = 0.6; // seconds

/** The cursor and its click ripples, in viewport pixels; the parent scales them. */
export function Cursor({ events }: { events: VideoEvent[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const { x, y } = cursorAt(t, events);
  const last = clicksBefore(t, events).at(-1);
  const since = last ? t - last.t : Infinity;
  const press = interpolate(since, [0, 0.08, 0.25], [1, 0.82, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <>
      {clicksBefore(t, events)
        .filter((c) => t - c.t < RIPPLE)
        .map((c) => {
          const k = (t - c.t) / RIPPLE;
          const r = 8 + 40 * (1 - (1 - k) ** 3);
          return (
            <div
              key={c.t}
              style={{
                position: "absolute",
                left: c.x - r,
                top: c.y - r,
                width: r * 2,
                height: r * 2,
                borderRadius: "50%",
                border: `3px solid ${color.accent}`,
                background: `${color.accent}22`,
                opacity: 1 - k,
              }}
            />
          );
        })}
      <svg
        width={SIZE}
        height={SIZE}
        viewBox="0 0 24 24"
        style={{
          position: "absolute",
          // The arrow's tip (3, 2) sits on the logged point.
          left: x - (3 / 24) * SIZE,
          top: y - (2 / 24) * SIZE,
          transform: `scale(${press})`,
          transformOrigin: `${(3 / 24) * 100}% ${(2 / 24) * 100}%`,
          filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.25))",
        }}
      >
        <path
          d="M3 2v18l5-4.5 3.5 7.5 3.2-1.4-3.4-7.3H18z"
          fill={color.ink}
          stroke={color.surface}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
}
