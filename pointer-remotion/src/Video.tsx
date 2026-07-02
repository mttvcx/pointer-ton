import React from "react";
import { AbsoluteFill, Audio, Series, staticFile } from "remotion";
import { colors } from "./theme";
import { SCRIPT, type VideoScript } from "./script";
import { SCENE_COMPONENTS, SceneBackground } from "./scenes";
import { Overlay, type CaptionMap } from "./Overlay";

// `type` (not `interface`) so it carries an implicit index signature and is
// assignable to Remotion's `Record<string, unknown>` props constraint.
export type PointerVideoProps = {
  script: VideoScript;
  captions: CaptionMap | null;
  /** Phase 4: lay the ElevenLabs VO under each scene. */
  withAudio: boolean;
  /** Phase 4 (optional): ambient bed at low volume under the whole video. */
  ambient: boolean;
};

const audioFileForIndex = (i: number) =>
  `vo/${String(i + 1).padStart(2, "0")}.mp3`;

export const PointerVideo: React.FC<PointerVideoProps> = ({
  script,
  captions,
  withAudio,
  ambient,
}) => {
  const s = script ?? SCRIPT;
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      <SceneBackground />

      <Series>
        {s.scenes.map((scene, i) => {
          const SceneComp = SCENE_COMPONENTS[scene.id];
          return (
            <Series.Sequence
              key={scene.id}
              durationInFrames={scene.durationInFrames}
              layout="none"
            >
              {SceneComp ? <SceneComp scene={scene} /> : null}
              {withAudio ? (
                <Audio src={staticFile(audioFileForIndex(i))} />
              ) : null}
            </Series.Sequence>
          );
        })}
      </Series>

      <Overlay script={s} captions={captions ?? undefined} />

      {withAudio && ambient ? (
        <Audio src={staticFile("vo/ambient.mp3")} volume={0.12} loop />
      ) : null}
    </AbsoluteFill>
  );
};
