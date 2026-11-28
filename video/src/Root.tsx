import { Composition, staticFile } from "remotion";
import { Demo, END_CARD, type DemoProps } from "./Demo.tsx";
import type { EventLog } from "./events.ts";
import "./fonts.ts";

const FPS = 30;

// 1920×1080, 30 fps; the last recording, then the end card (specs/demo-video.md).
export function Root() {
  return (
    <Composition
      id="Demo"
      component={Demo}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ log: { duration: 1, events: [] } } satisfies DemoProps}
      calculateMetadata={async () => {
        const log: EventLog = await (await fetch(staticFile("events.json"))).json();
        return { props: { log }, durationInFrames: Math.ceil((log.duration + END_CARD) * FPS) };
      }}
    />
  );
}
