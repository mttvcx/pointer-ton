import React from "react";
import { Composition } from "remotion";
import { PointerVideo, type PointerVideoProps } from "./Video";
import { SCRIPT, totalDurationInFrames, FPS } from "./script";
import { WIDTH, HEIGHT } from "./theme";
import type { CaptionMap } from "./Overlay";
import captionsJson from "../public/vo/captions.json";

const captions = captionsJson as CaptionMap;

/**
 * Composition duration is derived from the script prop via calculateMetadata,
 * so a different `script` passed with --props (Phase 7 batch) sets its own length.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="PointerVideo"
      component={PointerVideo}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={totalDurationInFrames(SCRIPT)}
      defaultProps={{
        script: SCRIPT,
        captions,
        withAudio: true,
        ambient: false,
      }}
      calculateMetadata={({ props }) => {
        const script = props.script ?? SCRIPT;
        return {
          durationInFrames: totalDurationInFrames(script),
          props,
        };
      }}
    />
  );
};
