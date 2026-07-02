# Pointer — QOVES-style explainer video (Remotion)

Vertical **1080×1920** crypto explainer videos in a muted, editorial (QOVES-ish)
style, for marketing **Pointer**, a Solana trading terminal. Voiceover is
generated with **ElevenLabs**; captions are word-synced to the VO; scene lengths
are driven automatically by the real audio.

The aesthetic is intentional: muted slate background, Playfair Display italic
captions, Inter for UI/data, and crypto data-viz (candles / wallets /
conviction) **instead of faces**. No neon, no glow, no stock people.

---

## 1. Setup

```bash
cd pointer-remotion
npm install
cp .env.example .env        # then put your ElevenLabs key in .env
```

`.env`:

```
ELEVENLABS_API_KEY=sk_...            # required
# ELEVENLABS_VOICE_ID=pqHfZKP75CvOlQylNhV4   # optional voice override
```

ffmpeg / ffprobe are bundled via the `ffmpeg-static` / `ffprobe-static` npm
packages — nothing to install system-wide. Node 18+ (built/tested on Node 24).

---

## 2. The script (source of truth)

All copy lives in [`src/script.ts`](src/script.ts): 8 scenes, each with an
`eyebrow`, the VO `lines`, the on-screen `caption`, and `dotsFilled` (step-dot
progress). **Scene durations are not hand-set** — they are computed from
`public/vo/manifest.json` (the real audio) as:

```
durationInFrames = ceil(durationSec * 30) + round(0.4 * 30)   // 0.4s tail pad
```

The 8 scenes: `hook · mythbust · ledger · tracked · conviction · chart · terminal · end`.
Each maps to a data-viz component in [`src/scenes/index.tsx`](src/scenes/index.tsx).
The text chrome (eyebrow, step dots, serif subtitle, watermark) is drawn once,
across the whole video, by [`src/Overlay.tsx`](src/Overlay.tsx).

---

## 3. Generate the voiceover + captions

```bash
npm run build-vo
```

This (see [`scripts/build-vo.ts`](scripts/build-vo.ts)):

1. Renders **each line** through ElevenLabs (so multi-sentence scenes get
   natural pacing) using the `/with-timestamps` endpoint.
2. Concatenates the lines (with a 0.28s gap) into `public/vo/01.mp3 … 08.mp3`.
3. `ffprobe`s each clip and writes `public/vo/manifest.json` (drives durations).
4. Writes `public/vo/captions.json` — **word-level timings** taken from the same
   generation as the audio, so captions are exactly in sync.

> **Voice.** Default narrator is ElevenLabs **"Bill"** (deep, measured,
> documentary). Change it by setting `ELEVENLABS_VOICE_ID` in `.env`, or edit the
> `VOICE_ID` constant in `scripts/build-vo.ts`. Run `LIST_VOICES=1 npm run build-vo`
> to print deep-narrator candidates + IDs from your library.

> **Why not Whisper?** The prompt suggested Whisper for word timestamps. We use
> ElevenLabs forced alignment instead: it's exact to the generated audio (no
> drift from re-transcribing an mp3) and needs no local PyTorch/whisper.cpp
> install (PyTorch has no wheels for the Python 3.14 on this machine). To switch
> to Whisper, transcribe each `public/vo/0N.mp3` with `--word_timestamps` and
> write the same `captions.json` shape: `{ sceneId: [{ word, start, end }] }`
> (times in seconds, relative to the scene's audio start).

---

## 4. Preview & render

```bash
npm run dev        # Remotion Studio at the "PointerVideo" composition
npm run render     # -> out/pointer.mp4
```

---

## 5. Batch system (many accounts)

Render a different script per account by passing a props file to the composition.

### (a) Write a new batch script JSON

Create `scripts/batch/<name>.json`. It is a full props object:

```jsonc
{
  "script": {
    "totalDots": 8,
    "scenes": [
      {
        "id": "hook",            // must be one of the 8 known scene ids
        "eyebrow": "The Outlier",
        "lines": ["First sentence.", "Second sentence."],
        "caption": "First sentence. Second sentence.",
        "dotsFilled": 1,
        "durationInFrames": 226  // see (b) — set from that script's manifest
      }
      // ... the other 7 scenes (same ids), in order ...
    ]
  },
  "captions": { "hook": [ { "word": "First", "start": 0.0, "end": 0.3 } ] },
  "withAudio": true,
  "ambient": false
}
```

`scripts/batch/example.json` is a ready-to-render copy of the default video —
start from it.

### (b) Generate VO for it

```bash
npm run build-vo -- scripts/batch/<name>.json
```

This writes the audio + `manifest.json` + `captions.json` into `public/vo/`.
Copy the resulting `durationInFrames` (ceil(dur*30)+12 per scene) and the
`captions` into your batch JSON so the file is self-contained.

> ⚠️ All scripts share one `public/vo/` folder. Generate a script's VO
> immediately before rendering it, or give each account its own checkout, so the
> audio on disk matches the script being rendered.

### (c) Render all

```bash
npm run render-all      # renders out/<name>.mp4 for every scripts/batch/*.json
```

(see [`scripts/render-all.ts`](scripts/render-all.ts) — it shells out to
`npx remotion render PointerVideo out/<name>.mp4 --props=<file>`.)

### Scaling to hundreds

For high volume, [Remotion Lambda](https://www.remotion.dev/docs/lambda)
(`@remotion/lambda`) renders many videos in parallel in the cloud. Not set up
here — ask if you want it.

---

## 6. Project layout

```
pointer-remotion/
├─ src/
│  ├─ index.ts            registerRoot
│  ├─ Root.tsx            composition registration (duration from script)
│  ├─ Video.tsx           scenes (Series) + per-scene <Audio> + Overlay
│  ├─ Overlay.tsx         eyebrow, step dots, karaoke serif subtitle, watermark
│  ├─ scenes/index.tsx    the 8 data-viz scene components
│  ├─ script.ts           SOURCE OF TRUTH for copy; durations from manifest
│  └─ theme.ts            palette + fonts (Playfair Display, Inter)
├─ scripts/
│  ├─ build-vo.ts         ElevenLabs VO + word-timed captions
│  ├─ render-all.ts       batch renderer
│  └─ batch/              per-account props JSON
├─ public/vo/            generated mp3s (gitignored) + manifest/captions json
└─ out/                  rendered mp4s
```

## 7. Constraints honored

- Secrets only from `.env`; `.env.example` is committed, `.env` is not.
- No real people's photos; no copyrighted music (ambient bed is off by default
  and only enabled with a license-free track you supply at `public/vo/ambient.mp3`).
- Muted editorial aesthetic throughout.
