/**
 * PHASE 2 + 3 — Voiceover generation via ElevenLabs, per LINE, concatenated per
 * scene into vo/01.mp3 … vo/08.mp3, then ffprobe each to write vo/manifest.json
 * (which src/script.ts reads to auto-fit scene durations to the real audio).
 *
 * Run:  npm run build-vo
 *       npm run build-vo -- scripts/batch/<name>.json   (Phase 7: alt script)
 *
 * Secrets come ONLY from .env (ELEVENLABS_API_KEY). Never hardcode the key.
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

/**
 * VOICE_ID — a calm, deep, authoritative male narrator (documentary tone).
 * Default below is ElevenLabs "Bill" (deep, measured, mature American narrator).
 * To change: set ELEVENLABS_VOICE_ID in .env, or replace this constant. Run
 * this script once with LIST_VOICES=1 to print deep-narrator candidates + IDs.
 *
 * A few good deep narrators from the default ElevenLabs library:
 *   Bill   pqHfZKP75CvOlQylNhV4   (deep, mature, documentary)   <-- default
 *   Adam   pNInz6obpgDQGcFmaJgB   (deep, neutral, versatile)
 *   George JBFqnCBsd6RMkjVDRZzb   (warm, British, measured)
 *   Daniel onwK4e9ZLuTAKqWW03F9   (authoritative British news)
 */
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "pqHfZKP75CvOlQylNhV4";

const MODEL_ID = "eleven_multilingual_v2";
const VOICE_SETTINGS = {
  stability: 0.45,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true,
};
const OUTPUT_FORMAT = "mp3_44100_128";
const GAP_SECONDS = 0.28; // silence inserted between sentences within a scene

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
// Output under public/ so Remotion's staticFile("vo/0N.mp3") can serve the clips.
const VO_DIR = resolve(ROOT, "public", "vo");
const TMP_DIR = resolve(VO_DIR, ".tmp");

const FFMPEG = (ffmpegPath as unknown as string) || "ffmpeg";
const FFPROBE = ffprobeStatic.path;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const probeDuration = (file: string): number => {
  const out = execFileSync(FFPROBE, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  return parseFloat(out.toString().trim());
};

interface WordTiming {
  word: string;
  start: number;
  end: number;
}

interface Alignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

// Collapse ElevenLabs character-level alignment into word timings.
function charsToWords(a: Alignment): WordTiming[] {
  const words: WordTiming[] = [];
  let cur = "";
  let startIdx = -1;
  let lastEnd = 0;
  const flush = () => {
    if (cur) {
      words.push({
        word: cur,
        start: a.character_start_times_seconds[startIdx] ?? lastEnd,
        end: lastEnd,
      });
    }
    cur = "";
    startIdx = -1;
  };
  for (let i = 0; i < a.characters.length; i++) {
    const c = a.characters[i];
    if (/\s/.test(c)) {
      flush();
    } else {
      if (cur === "") startIdx = i;
      cur += c;
      lastEnd = a.character_end_times_seconds[i];
    }
  }
  flush();
  return words;
}

/**
 * Generate one line via the with-timestamps endpoint so the audio AND its
 * word alignment come from the SAME generation (guaranteed in sync). This is
 * used instead of running Whisper on the mp3 afterward — more accurate, and it
 * sidesteps the local torch/whisper.cpp install (no PyTorch wheels for Py3.14).
 */
async function tts(text: string): Promise<{ audio: Buffer; words: WordTiming[] }> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps?output_format=${OUTPUT_FORMAT}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY as string,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: VOICE_SETTINGS,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs TTS ${res.status}: ${body.slice(0, 500)}`);
  }
  const json = (await res.json()) as {
    audio_base64: string;
    alignment: Alignment;
  };
  return {
    audio: Buffer.from(json.audio_base64, "base64"),
    words: charsToWords(json.alignment),
  };
}

async function printVoiceName() {
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY as string },
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      voices: { voice_id: string; name: string; labels?: Record<string, string> }[];
    };
    const chosen = data.voices.find((v) => v.voice_id === VOICE_ID);
    console.log(
      `\n🎙  Narrator voice: ${chosen ? chosen.name : "(custom)"} [${VOICE_ID}]`
    );
    if (process.env.LIST_VOICES) {
      console.log("\nDeep / male narrator candidates in your library:");
      data.voices
        .filter((v) => {
          const l = JSON.stringify(v.labels || {}).toLowerCase();
          return l.includes("deep") || l.includes("male") || l.includes("narrat");
        })
        .forEach((v) =>
          console.log(`  ${v.name.padEnd(16)} ${v.voice_id}  ${JSON.stringify(v.labels)}`)
        );
    }
    console.log("   (override with ELEVENLABS_VOICE_ID in .env)\n");
  } catch {
    /* non-fatal */
  }
}

function makeSilence(seconds: number, out: string) {
  execFileSync(FFMPEG, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `anullsrc=r=44100:cl=mono`,
    "-t",
    String(seconds),
    "-q:a",
    "9",
    out,
  ]);
}

function concatScene(parts: string[], out: string) {
  if (parts.length === 1) {
    // re-encode single part for a clean, uniform file
    execFileSync(FFMPEG, ["-y", "-i", parts[0], "-ar", "44100", "-ac", "1", out]);
    return;
  }
  const listFile = resolve(TMP_DIR, "concat.txt");
  writeFileSync(
    listFile,
    parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n")
  );
  execFileSync(FFMPEG, [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listFile,
    "-ar",
    "44100",
    "-ac",
    "1",
    out,
  ]);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface SceneLike {
  id: string;
  lines: string[];
}

async function loadScenes(): Promise<SceneLike[]> {
  const argPath = process.argv[2];
  if (argPath) {
    const json = JSON.parse(await readFile(resolve(process.cwd(), argPath), "utf8"));
    const scenes = (json.scenes ?? json) as SceneLike[];
    return scenes.map((s) => ({ id: s.id, lines: s.lines }));
  }
  // default: pull straight from the canonical SCRIPT
  const mod = await import("../src/script.ts");
  return (mod.SCRIPT.scenes as SceneLike[]).map((s) => ({ id: s.id, lines: s.lines }));
}

async function main() {
  if (!process.env.ELEVENLABS_API_KEY) {
    console.error(
      "\n❌ ELEVENLABS_API_KEY is missing. Copy .env.example to .env and set it.\n"
    );
    process.exit(1);
  }

  mkdirSync(VO_DIR, { recursive: true });
  rmSync(TMP_DIR, { recursive: true, force: true });
  mkdirSync(TMP_DIR, { recursive: true });

  await printVoiceName();

  const scenes = await loadScenes();
  const silenceFile = resolve(TMP_DIR, "gap.mp3");
  makeSilence(GAP_SECONDS, silenceFile);

  const manifest: {
    id: string;
    file: string;
    durationSec: number;
    lines: { text: string; start: number; end: number }[];
  }[] = [];
  // captions: scene id -> word timings relative to that scene's audio start
  const captions: Record<string, WordTiming[]> = {};

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const sceneNo = String(i + 1).padStart(2, "0");
    const parts: string[] = [];
    const lineMeta: { text: string; durationSec: number; words: WordTiming[] }[] = [];

    for (let l = 0; l < scene.lines.length; l++) {
      const text = scene.lines[l];
      process.stdout.write(`  [${sceneNo}] line ${l + 1}/${scene.lines.length}: "${text.slice(0, 42)}"… `);
      const { audio, words } = await tts(text);
      const lineFile = resolve(TMP_DIR, `${sceneNo}_${l}.mp3`);
      writeFileSync(lineFile, audio);
      const dur = probeDuration(lineFile);
      lineMeta.push({ text, durationSec: dur, words });
      console.log(`${dur.toFixed(2)}s, ${words.length} words`);
      if (l > 0) parts.push(silenceFile);
      parts.push(lineFile);
    }

    const sceneFile = resolve(VO_DIR, `${sceneNo}.mp3`);
    concatScene(parts, sceneFile);
    const sceneDur = probeDuration(sceneFile);

    // Offset each line's per-word timings into the concatenated scene timeline.
    let cursor = 0;
    const lines = lineMeta.map((m, idx) => {
      const start = cursor + (idx > 0 ? GAP_SECONDS : 0);
      const end = start + m.durationSec;
      const offset = start;
      (captions[scene.id] ??= []).push(
        ...m.words.map((w) => ({
          word: w.word,
          start: +(w.start + offset).toFixed(3),
          end: +(w.end + offset).toFixed(3),
        }))
      );
      cursor = end;
      return { text: m.text, start: +start.toFixed(3), end: +end.toFixed(3) };
    });

    manifest.push({
      id: scene.id,
      file: `vo/${sceneNo}.mp3`,
      durationSec: sceneDur,
      lines,
    });
    console.log(`  → ${sceneFile.replace(ROOT + "\\", "").replace(ROOT + "/", "")}  (${sceneDur.toFixed(2)}s)\n`);
  }

  writeFileSync(resolve(VO_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(resolve(VO_DIR, "captions.json"), JSON.stringify(captions, null, 2));
  rmSync(TMP_DIR, { recursive: true, force: true });

  const total = manifest.reduce((s, m) => s + m.durationSec, 0);
  const wordCount = Object.values(captions).reduce((s, w) => s + w.length, 0);
  console.log(
    `✅ Wrote ${manifest.length} clips + manifest.json + captions.json ` +
      `(total VO ${total.toFixed(2)}s, ${wordCount} timed words)`
  );
  if (!existsSync(FFMPEG)) console.warn("⚠ ffmpeg-static path missing?");
}

main().catch((e) => {
  console.error("\n❌ build-vo failed:", e.message || e);
  process.exit(1);
});
