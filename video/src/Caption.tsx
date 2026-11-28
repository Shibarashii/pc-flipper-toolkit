import { useCurrentFrame, useVideoConfig } from "remotion";
import type { VideoEvent } from "./events.ts";
import { captionAt } from "./steps.ts";
import { color } from "./theme.ts";

/** The step's caption in a paper pill under the window (specs/demo-video.md). */
export function Caption({ events }: { events: VideoEvent[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { text, opacity } = captionAt(frame / fps, events);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        // The band under the window (it ends at 924px).
        top: 924,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          opacity,
          padding: "10px 32px 14px",
          borderRadius: 999,
          border: `1px solid ${color.line}`,
          background: color.surface,
          fontFamily: "Newsreader",
          fontWeight: 500,
          fontSize: 56,
          lineHeight: "68px",
          letterSpacing: "-0.01em",
          color: color.ink,
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
    </div>
  );
}
