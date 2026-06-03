/**
 * Resize protocol logos for UI badges (display ~14–32px).
 * Run: node scripts/optimize-protocol-logos.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const DIR = path.join(process.cwd(), 'public', 'logos', 'protocols');
const MAX_BYTES = 120 * 1024;
const TARGET_PX = 128;

async function optimizeFile(filePath) {
  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.webp', '.avif'].includes(ext)) return null;

  if (stat.size <= MAX_BYTES) {
    return { name: path.basename(filePath), before: stat.size, after: stat.size, skipped: true };
  }

  const before = stat.size;
  const tmp = `${filePath}.opt.tmp`;

  if (ext === '.png') {
    await sharp(filePath)
      .resize(TARGET_PX, TARGET_PX, { fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true, quality: 80 })
      .toFile(tmp);
  } else if (ext === '.webp' || ext === '.avif') {
    await sharp(filePath)
      .resize(TARGET_PX, TARGET_PX, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(tmp.replace(ext, '.webp'));
    fs.renameSync(tmp.replace(ext, '.webp'), filePath);
    const after = fs.statSync(filePath).size;
    return { name: path.basename(filePath), before, after, skipped: false };
  } else {
    await sharp(filePath)
      .resize(TARGET_PX, TARGET_PX, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(tmp);
  }

  fs.renameSync(tmp, filePath);
  const after = fs.statSync(filePath).size;
  return { name: path.basename(filePath), before, after, skipped: false };
}

async function main() {
  const files = fs.readdirSync(DIR).map((f) => path.join(DIR, f));
  const results = [];
  for (const f of files) {
    if (!fs.statSync(f).isFile()) continue;
    try {
      const r = await optimizeFile(f);
      if (r) results.push(r);
    } catch (err) {
      console.error('failed', path.basename(f), err);
    }
  }

  results.sort((a, b) => b.before - a.before);
  for (const r of results) {
    if (r.skipped) continue;
    console.log(
      `${r.name}: ${(r.before / 1024).toFixed(0)}KB → ${(r.after / 1024).toFixed(1)}KB`,
    );
  }
  const saved = results.filter((r) => !r.skipped).reduce((s, r) => s + (r.before - r.after), 0);
  console.log(`Done. Saved ~${(saved / 1024 / 1024).toFixed(1)}MB across ${results.filter((r) => !r.skipped).length} files.`);
}

main();
