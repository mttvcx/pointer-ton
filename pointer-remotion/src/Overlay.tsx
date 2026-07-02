import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, fonts } from "./theme";
import type { VideoScript } from "./script";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface ActiveScene {
  index: number;
  start: number;
  duration: number;
  local: number;
}

const activeSceneFor = (script: VideoScript, frame: number): ActiveScene => {
  let start = 0;
  for (let i = 0; i < script.scenes.length; i++) {
    const d = script.scenes[i].durationInFrames;
    if (frame < start + d || i === script.scenes.length - 1) {
      return { index: i, start, duration: d, local: frame - start };
    }
    start += d;
  }
  return { index: 0, start: 0, duration: 1, local: 0 };
};

// Per-word caption timings (Phase 5: from vo/captions.json). Optional.
export interface WordTiming {
  word: string;
  start: number; // seconds, relative to scene start
  end: number;
}
export interface CaptionMap {
  [sceneId: string]: WordTiming[];
}

const Eyebrow: React.FC<{ text: string; opacity: number }> = ({
  text,
  opacity,
}) => (
  <div
    style={{
      position: "absolute",
      top: 120,
      left: 90,
      opacity,
      fontFamily: fonts.sans,
      fontSize: 24,
      letterSpacing: 5,
      textTransform: "uppercase",
      color: colors.inkDim,
      fontWeight: 500,
    }}
  >
    <span style={{ color: colors.accent }}>—</span>&nbsp;&nbsp;{text}
  </div>
);

const StepDots: React.FC<{ total: number; filled: number; fillProg: number }> = ({
  total,
  filled,
  fillProg,
}) => (
  <div
    style={{
      position: "absolute",
      top: 180,
      left: 90,
      display: "flex",
      gap: 14,
      alignItems: "center",
    }}
  >
    {Array.from({ length: total }).map((_, i) => {
      const isCurrent = i === filled - 1;
      const on = i < filled - 1 || (isCurrent && fillProg > 0.5);
      return (
        <div
          key={i}
          style={{
            width: on ? 26 : 10,
            height: 4,
            borderRadius: 4,
            background: on ? colors.accent : colors.lineStrong,
            transition: "none",
          }}
        />
      );
    })}
  </div>
);

const Watermark: React.FC = () => (
  <div
    style={{
      position: "absolute",
      bottom: 70,
      left: 0,
      right: 0,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      gap: 12,
      opacity: 0.5,
    }}
  >
    <svg width={22} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="40" fill="none" stroke={colors.inkDim} strokeWidth="6" />
      <circle cx="50" cy="50" r="10" fill={colors.accent} />
    </svg>
    <span
      style={{
        fontFamily: fonts.sans,
        fontSize: 22,
        letterSpacing: 6,
        textTransform: "uppercase",
        color: colors.inkDim,
        fontWeight: 500,
      }}
    >
      Pointer
    </span>
  </div>
);

const Subtitle: React.FC<{
  caption: string;
  words?: WordTiming[];
  local: number;
  duration: number;
  fps: number;
  reduced: boolean;
}> = ({ caption, words, local, duration, fps, reduced }) => {
  const tSec = local / fps;
  const inOp = interpolate(local, [0, reduced ? 1 : 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outOp = interpolate(
    local,
    [duration - (reduced ? 1 : 12), duration],
    [1, reduced ? 1 : 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const op = Math.min(inOp, outOp);

  const tokens = caption.split(" ");
  const hasTimings = !!words && words.length > 0;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 200,
        left: 0,
        right: 0,
        padding: "0 110px",
        textAlign: "center",
        opacity: op,
      }}
    >
      <p
        style={{
          fontFamily: fonts.serif,
          fontStyle: "italic",
          fontWeight: 500,
          fontSize: 58,
          lineHeight: 1.32,
          color: colors.ink,
          margin: 0,
          textWrap: "balance",
        }}
      >
        {tokens.map((tok, i) => {
          // Karaoke highlight when timings exist; else gentle staggered reveal.
          let color: string | undefined = undefined;
          let wordOp = 1;
          if (hasTimings && !reduced) {
            const w = words![Math.min(i, words!.length - 1)];
            if (w && tSec >= w.end) {
              color = colors.ink; // already spoken
              wordOp = 1;
            } else if (w && tSec >= w.start) {
              color = colors.accent; // currently spoken
              wordOp = 1;
            } else {
              wordOp = 0.3; // upcoming
            }
          } else if (hasTimings && reduced) {
            wordOp = 1; // reduced motion: show the whole line steadily
          } else if (!reduced) {
            wordOp = interpolate(
              local,
              [6 + i * 1.6, 6 + i * 1.6 + 10],
              [0.3, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
          }
          return (
            <span key={i} style={{ color, opacity: wordOp }}>
              {tok}
              {i < tokens.length - 1 ? " " : ""}
            </span>
          );
        })}
      </p>
    </div>
  );
};

export const Overlay: React.FC<{
  script: VideoScript;
  captions?: CaptionMap;
}> = ({ script, captions }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reduced = prefersReducedMotion();
  const { index, duration, local } = activeSceneFor(script, frame);
  const scene = script.scenes[index];

  const eyebrowOp = interpolate(
    local,
    [0, reduced ? 1 : 10, duration - 10, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const fillProg = interpolate(local, [4, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Eyebrow text={scene.eyebrow} opacity={eyebrowOp} />
      <StepDots total={script.totalDots} filled={scene.dotsFilled} fillProg={fillProg} />
      <Subtitle
        caption={scene.caption}
        words={captions?.[scene.id]}
        local={local}
        duration={duration}
        fps={fps}
        reduced={reduced}
      />
      <Watermark />
    </AbsoluteFill>
  );
};
