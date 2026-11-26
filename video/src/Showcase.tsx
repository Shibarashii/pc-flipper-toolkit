import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { BEATS, TOTAL_FRAMES } from "./beats";
import { Phone } from "./Phone";
import { PartsStill } from "./scenes/PartsStill";

// Captions cross-fade over 10 frames, centred on each beat's cut (specs/showcase-video.md).
const FADE = 10;

const starts = BEATS.map((_, i) =>
  BEATS.slice(0, i).reduce((sum, b) => sum + b.frames, 0),
);

export function Showcase() {
  return (
    <AbsoluteFill className="bg-bg text-ink">
      <div className="absolute top-[300px] right-[80px] left-[80px]">
        <Phone>
          <PartsStill />
        </Phone>
      </div>
      {BEATS.map((beat, i) => {
        const from = Math.max(0, starts[i] - FADE / 2);
        const to = Math.min(TOTAL_FRAMES, starts[i] + beat.frames + FADE / 2);
        return (
          <Sequence key={beat.id} name={beat.id} from={from} durationInFrames={to - from}>
            <Caption
              text={beat.caption}
              fadeIn={i > 0}
              fadeOut={i < BEATS.length - 1}
              frames={to - from}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

function Caption({
  text,
  fadeIn,
  fadeOut,
  frames,
}: {
  text: string;
  fadeIn: boolean;
  fadeOut: boolean;
  frames: number;
}) {
  const frame = useCurrentFrame();
  const opacity = Math.min(
    fadeIn ? interpolate(frame, [0, FADE], [0, 1], { extrapolateRight: "clamp" }) : 1,
    fadeOut
      ? interpolate(frame, [frames - FADE, frames], [1, 0], { extrapolateLeft: "clamp" })
      : 1,
  );
  return (
    <h1
      className="absolute top-[100px] right-[80px] left-[80px] font-serif text-[64px] leading-[72px] font-medium tracking-[-0.01em] text-balance"
      style={{ opacity }}
    >
      {text}
    </h1>
  );
}
