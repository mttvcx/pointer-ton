import 'server-only';

import sharp from 'sharp';
import { computeDHashFromGrayscale } from '@/lib/image/perceptualHash';

const DHASH_WIDTH = 9;
const DHASH_HEIGHT = 8;
const FETCH_TIMEOUT_MS = 15_000;

export type TweetImageHashEntry = {
  url: string;
  hash: string;
};

export async function hashImageBuffer(buffer: Buffer): Promise<string> {
  const { data, info } = await sharp(buffer)
    .rotate()
    .resize(DHASH_WIDTH, DHASH_HEIGHT, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return computeDHashFromGrayscale(data, info.width, info.height);
}

export async function hashImageUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'image/*' },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 32 || buf.length > 8 * 1024 * 1024) return null;
    return await hashImageBuffer(buf);
  } catch {
    return null;
  }
}

/** Hash each image URL (best-effort, parallel capped). */
export async function hashTweetImageUrls(urls: string[]): Promise<TweetImageHashEntry[]> {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))].slice(0, 12);
  if (unique.length === 0) return [];

  const out: TweetImageHashEntry[] = [];
  const batchSize = 4;
  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (url) => {
        const hash = await hashImageUrl(url);
        return hash ? { url, hash } : null;
      }),
    );
    for (const r of results) {
      if (r) out.push(r);
    }
  }
  return out;
}
