import { OffthreadVideo, staticFile } from "remotion";
import { Cursor } from "./Cursor.tsx";
import type { EventLog } from "./events.ts";
import { SCALE, VIEWPORT, Window } from "./Window.tsx";

export type DemoProps = { log: EventLog };

/** The recording in its window, with the drawn cursor (specs/demo-video.md). */
export function Demo({ log }: DemoProps) {
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
        <OffthreadVideo
          src={staticFile("demo.mp4")}
          style={{ width: VIEWPORT.width, height: VIEWPORT.height }}
        />
        <Cursor events={log.events} />
      </div>
    </Window>
  );
}
