import { OffthreadVideo, Sequence, staticFile, useVideoConfig } from "remotion";
import { Caption } from "./Caption.tsx";
import { Cursor } from "./Cursor.tsx";
import { EndCard } from "./EndCard.tsx";
import type { EventLog } from "./events.ts";
import { SCALE, VIEWPORT, Window } from "./Window.tsx";

export type DemoProps = { log: EventLog };

export const END_CARD = 5; // seconds after the recording

/** The recording in its window, with the drawn cursor and the captions, then the end card
 * (specs/demo-video.md). */
export function Demo({ log }: DemoProps) {
  const { fps } = useVideoConfig();
  // The end card is step 7, so the last caption fades out as it comes in.
  const end = Math.round(log.duration * fps);
  const withEnd = [...log.events, { t: log.duration, type: "step" as const, step: 7 }];
  return (
    <>
      <Window>
        <div
          style={{
            position: "absolute",
            width: VIEWPORT.width,
            height: VIEWPORT.height,
            transform: `scale(${SCALE})`,
            transformOrigin: "0 0",
          }}
        >
          <OffthreadVideo
            src={staticFile("demo.mp4")}
            style={{ width: VIEWPORT.width, height: VIEWPORT.height }}
          />
          <Cursor events={log.events} />
        </div>
      </Window>
      <Caption events={withEnd} />
      {/* Over the last half second of the recording, so the two cross-fade. */}
      <Sequence from={end - Math.round(0.5 * fps)}>
        <EndCard />
      </Sequence>
    </>
  );
}
