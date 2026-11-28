import type { ReactNode } from "react";
import { color } from "./theme.ts";

// The recording's 1280×720 viewport, scaled to fit the frame with room for captions below.
export const VIEWPORT = { width: 1280, height: 720 };
export const SCALE = 1.15;
const BAR = 44;
const WIDTH = VIEWPORT.width * SCALE;
const LEFT = (1920 - WIDTH) / 2;
const TOP = 50;

/** A plain browser window on the paper background: hairline, rounded, the address on top. */
export function Window({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: color.bg }}>
      <div
        style={{
          position: "absolute",
          left: LEFT,
          top: TOP,
          width: WIDTH,
          border: `1px solid ${color.lineStrong}`,
          borderRadius: 14,
          overflow: "hidden",
          background: color.surface,
        }}
      >
        <div
          style={{
            height: BAR,
            borderBottom: `1px solid ${color.lineStrong}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Instrument Sans",
            fontSize: 18,
            color: color.muted,
          }}
        >
          pc-flipper-toolkit.vercel.app
        </div>
        <div
          style={{
            position: "relative",
            width: WIDTH,
            height: VIEWPORT.height * SCALE,
            overflow: "hidden",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
