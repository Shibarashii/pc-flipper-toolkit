import { Composition } from "remotion";
import { FPS, TOTAL_FRAMES } from "./beats";
import "./fonts";
import "./index.css";
import { Showcase } from "./Showcase";

// 1080×1350 (4:5), 30 fps, 60 s (specs/showcase-video.md).
export function Root() {
  return (
    <Composition
      id="Showcase"
      component={Showcase}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1080}
      height={1350}
    />
  );
}
