import { OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { cameraAt } from "./camera.ts";
import { Cursor } from "./Cursor.tsx";
import type { EventLog } from "./events.ts";
import { zoomAt } from "./steps.ts";
import { SCALE, VIEWPORT, Window } from "./Window.tsx";

export type DemoProps = { log: EventLog };

/** The recording in its window, with the drawn cursor and the camera (specs/demo-video.md). */
export function Demo({ log }: DemoProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { x, y, zoom } = cameraAt(frame, log.events, fps, zoomAt(log.events));
  // The view's top-left corner, in viewport pixels.
  const left = x - VIEWPORT.width / (2 * zoom);
  const top = y - VIEWPORT.height / (2 * zoom);
  return (
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
        <div
          style={{
            position: "absolute",
            width: VIEWPORT.width,
            height: VIEWPORT.height,
            transform: `scale(${zoom}) translate(${-left}px, ${-top}px)`,
            transformOrigin: "0 0",
          }}
        >
          <OffthreadVideo
            src={staticFile("demo.mp4")}
            style={{ width: VIEWPORT.width, height: VIEWPORT.height }}
          />
          <Cursor events={log.events} />
        </div>
      </div>
    </Window>
  );
}
