import { Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import logo from "../../frontend/public/logo-light.png";
import { steps } from "./steps.ts";
import { color } from "./theme.ts";

/** The last 5 seconds: the logo, the headline, the demo and the link; no name (spec, Decided). */
export function EndCard() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, 0.5 * fps], [0, 1], { extrapolateRight: "clamp" });
  const rise = interpolate(frame, [0, 0.8 * fps], [24, 0], {
    extrapolateRight: "clamp",
    easing: (k) => 1 - (1 - k) ** 3,
  });
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: color.bg,
        opacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
          transform: `translateY(${rise}px)`,
        }}
      >
        <Img src={logo} style={{ width: 120, height: 120 }} />
        <p
          style={{
            margin: 0,
            fontFamily: "Newsreader",
            fontWeight: 500,
            fontSize: 84,
            lineHeight: "92px",
            letterSpacing: "-0.01em",
            color: color.ink,
          }}
        >
          {steps[7].caption}
        </p>
        <p style={{ margin: 0, fontFamily: "Instrument Sans", fontSize: 36, color: color.muted }}>
          Try the demo, no sign-up needed
        </p>
        <p
          style={{
            margin: 0,
            fontFamily: "Instrument Sans",
            fontWeight: 500,
            fontSize: 40,
            color: color.accent,
          }}
        >
          pc-flipper-toolkit.vercel.app
        </p>
      </div>
    </div>
  );
}
