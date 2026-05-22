/** 64-bit difference hash (dHash) — same algorithm in browser + Node for comparable Hamming scores. */

export const IMAGE_HASH_HEX_LEN = 16;

export const HAMMING_THRESHOLD_PRESETS = {
  strict: 4,
  normal: 8,
  loose: 12,
} as const;

export type HammingThresholdPreset = keyof typeof HAMMING_THRESHOLD_PRESETS;

export function hammingThresholdFromPreset(
  preset: HammingThresholdPreset | undefined,
): number {
  if (!preset) return HAMMING_THRESHOLD_PRESETS.normal;
  return HAMMING_THRESHOLD_PRESETS[preset] ?? HAMMING_THRESHOLD_PRESETS.normal;
}

export function normalizeImageHashHex(raw: string): string | null {
  const h = raw.trim().toLowerCase();
  if (!/^[0-9a-f]{16}$/.test(h)) return null;
  return h;
}

/** Hamming distance between two 64-bit hex hashes. */
export function hammingDistanceHex(aHex: string, bHex: string): number {
  const a = normalizeImageHashHex(aHex);
  const b = normalizeImageHashHex(bHex);
  if (!a || !b) return 64;
  let aBits = BigInt(`0x${a}`);
  let bBits = BigInt(`0x${b}`);
  let xor = aBits ^ bBits;
  let dist = 0;
  while (xor > 0n) {
    dist += Number(xor & 1n);
    xor >>= 1n;
  }
  return dist;
}

export function imageHashesMatch(
  tweetHash: string,
  targetHash: string,
  threshold: number,
): boolean {
  return hammingDistanceHex(tweetHash, targetHash) <= Math.max(0, Math.floor(threshold));
}

/**
 * Build dHash from grayscale raster (row-major), resized to 9×8 before call.
 * Compares each pixel to its right neighbor → 64 bits.
 */
export function computeDHashFromGrayscale(
  gray: Uint8Array | Buffer,
  width: number,
  height: number,
): string {
  if (width < 2 || height < 1) return '0'.repeat(IMAGE_HASH_HEX_LEN);
  let bits = 0n;
  let bitIndex = 0;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width - 1; x++) {
      const left = gray[row + x] ?? 0;
      const right = gray[row + x + 1] ?? 0;
      if (left < right) {
        bits |= 1n << BigInt(63 - bitIndex);
      }
      bitIndex++;
      if (bitIndex >= 64) break;
    }
    if (bitIndex >= 64) break;
  }
  return bits.toString(16).padStart(IMAGE_HASH_HEX_LEN, '0');
}
