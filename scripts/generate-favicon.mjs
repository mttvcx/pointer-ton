/**
 * Generate public/branding/logo-white.png and public/favicon.ico from logo-bird.svg
 * Run: node scripts/generate-favicon.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import toIco from 'to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'public', 'branding', 'logo-bird.svg');
const pngOut = path.join(root, 'public', 'branding', 'logo-white.png');
const icoOut = path.join(root, 'public', 'favicon.ico');

const svg = await fs.readFile(svgPath);

const png512 = await sharp(svg).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

await fs.writeFile(pngOut, png512);
console.log('Wrote', path.relative(root, pngOut));

const sizes = [16, 32, 48];
const buffers = await Promise.all(
  sizes.map((s) =>
    sharp(svg).resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
  ),
);

const ico = await toIco(buffers);
await fs.writeFile(icoOut, ico);
console.log('Wrote', path.relative(root, icoOut));
