import { FPS } from "./theme";
import voManifest from "../public/vo/manifest.json";

/**
 * The SCRIPT — source of truth for all copy.
 *
 * 8 scenes. `lines` are the VO sentences (build-vo.ts renders each line via
 * ElevenLabs and concatenates them into one mp3 per scene, so multi-sentence
 * scenes get natural pacing). `caption` is what the serif subtitle shows.
 *
 * PHASE 3: scene length is driven by the REAL audio. We read vo/manifest.json
 * and set durationInFrames = ceil(durationSec * FPS) + round(0.4 * FPS) tail
 * padding. BASE_FRAMES below is only a fallback for scenes with no audio yet.
 */

interface ManifestEntry {
  id: string;
  file: string;
  durationSec: number;
  lines?: { text: string; start: number; end: number }[];
}

const TAIL_PADDING = Math.round(0.4 * FPS);

const durationFor = (id: SceneId): number => {
  const entry = (voManifest as ManifestEntry[]).find((m) => m.id === id);
  if (entry && entry.durationSec > 0) {
    return Math.ceil(entry.durationSec * FPS) + TAIL_PADDING;
  }
  return BASE_FRAMES[id]; // fallback when VO not generated for this scene
};

export type SceneId =
  | "hook"
  | "mythbust"
  | "ledger"
  | "tracked"
  | "conviction"
  | "chart"
  | "terminal"
  | "end";

export interface Scene {
  id: SceneId;
  /** Small uppercase editorial label, top-left. */
  eyebrow: string;
  /** VO sentences — one ElevenLabs render per line, concatenated per scene. */
  lines: string[];
  /** Full subtitle text shown on screen (defaults to lines joined). */
  caption: string;
  /** How many step-dots are filled by the end of this scene (of totalDots). */
  dotsFilled: number;
  /** Frames this scene is on screen. Phase 3 overwrites from real audio. */
  durationInFrames: number;
}

export interface VideoScript {
  scenes: Scene[];
  totalDots: number;
}

const join = (lines: string[]) => lines.join(" ");

// Fallback frame budget when a scene has no generated audio. Sums to 1485.
const BASE_FRAMES: Record<SceneId, number> = {
  hook: 210,
  mythbust: 180,
  ledger: 150,
  tracked: 195,
  conviction: 255,
  chart: 255,
  terminal: 165,
  end: 75,
};

const TOTAL_DOTS = 8;

const RAW_SCENES: Omit<Scene, "caption" | "durationInFrames">[] = [
  {
    id: "hook",
    eyebrow: "The Outlier",
    lines: [
      "A nineteen-year-old made three million dollars in one month.",
      "Trading memecoins.",
      "From his bedroom.",
    ],
    dotsFilled: 1,
  },
  {
    id: "mythbust",
    eyebrow: "The Question",
    lines: [
      "He's not smarter than you.",
      "He's not luckier than you.",
      "He just sees something you don't.",
    ],
    dotsFilled: 2,
  },
  {
    id: "ledger",
    eyebrow: "The Ledger",
    lines: [
      "Every trade on Solana is public.",
      "Every wallet.",
      "Every buy.",
      "Every sell.",
    ],
    dotsFilled: 3,
  },
  {
    id: "tracked",
    eyebrow: "The Pattern",
    lines: [
      "The winners aren't guessing which coin runs.",
      "They watch the wallets that always get in first.",
    ],
    dotsFilled: 4,
  },
  {
    id: "conviction",
    eyebrow: "Conviction",
    lines: [
      "Ten wallets that never lose, all buying the same token in the same minute.",
      "That's not luck.",
      "That's conviction — and you can measure it.",
    ],
    dotsFilled: 5,
  },
  {
    id: "chart",
    eyebrow: "The Exit",
    lines: [
      "By the time it's trending on your timeline, they've already sold it to you.",
      "The edge was never the coin.",
      "It was the information.",
    ],
    dotsFilled: 6,
  },
  {
    id: "terminal",
    eyebrow: "The Terminal",
    lines: [
      "Pointer puts every wallet, every signal, every smart-money move on one screen.",
      "So you're early — not exit liquidity.",
    ],
    dotsFilled: 7,
  },
  {
    id: "end",
    eyebrow: "Pointer",
    lines: ["Pointer.", "See what they see."],
    dotsFilled: 8,
  },
];

export const SCRIPT: VideoScript = {
  totalDots: TOTAL_DOTS,
  scenes: RAW_SCENES.map((s) => ({
    ...s,
    caption: join(s.lines),
    durationInFrames: durationFor(s.id),
  })),
};

export const totalDurationInFrames = (script: VideoScript = SCRIPT) =>
  script.scenes.reduce((sum, s) => sum + s.durationInFrames, 0);

export { FPS };
