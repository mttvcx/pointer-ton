/**
 * PHASE 7 — Batch renderer.
 *
 * Reads every JSON in scripts/batch/*.json and renders out/<name>.mp4 for each
 * via the Remotion CLI with that file passed as --props.
 *
 * Each batch JSON is a full PointerVideoProps object:
 *   { "script": { "totalDots": 8, "scenes": [ { id, eyebrow, lines, caption,
 *     dotsFilled, durationInFrames }, ... ] }, "captions": {...}|null,
 *     "withAudio": true, "ambient": false }
 *
 * VO for a batch script: run `npm run build-vo -- scripts/batch/<name>.json`
 * first (it generates per-scene mp3s into vo/ and a manifest). Note: audio
 * files live in one shared vo/ folder, so render a batch entry right after
 * generating its VO, or give each account its own checkout/run.
 *
 * Run:  npm run render-all
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { resolve, basename, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BATCH_DIR = resolve(ROOT, "scripts", "batch");
const OUT_DIR = resolve(ROOT, "out");

const files = readdirSync(BATCH_DIR)
  .filter((f: string) => extname(f).toLowerCase() === ".json")
  .sort();

if (files.length === 0) {
  console.log("No batch scripts found in scripts/batch/*.json — nothing to render.");
  process.exit(0);
}

console.log(`Found ${files.length} batch script(s): ${files.join(", ")}\n`);

let ok = 0;
for (const file of files) {
  const name = basename(file, ".json");
  const propsPath = resolve(BATCH_DIR, file);
  const outPath = resolve(OUT_DIR, `${name}.mp4`);
  console.log(`▶ Rendering ${name} → out/${name}.mp4`);

  const res = spawnSync(
    "npx",
    [
      "remotion",
      "render",
      "PointerVideo",
      outPath,
      `--props=${propsPath}`,
    ],
    { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" }
  );

  if (res.status === 0) {
    ok++;
    console.log(`✓ ${name} done\n`);
  } else {
    console.error(`✗ ${name} failed (exit ${res.status})\n`);
  }
}

console.log(`\nBatch complete: ${ok}/${files.length} rendered into out/`);
process.exit(ok === files.length ? 0 : 1);
