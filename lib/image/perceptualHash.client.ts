'use client';

import { computeDHashFromGrayscale } from '@/lib/image/perceptualHash';

const DHASH_WIDTH = 9;
const DHASH_HEIGHT = 8;

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image'));
    };
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

/** Client-side dHash (matches server perceptualHash pipeline). */
export async function hashImageFileClient(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('Image must be under 8 MB');
  }

  const img = await loadImageFromFile(file);
  const canvas = document.createElement('canvas');
  canvas.width = DHASH_WIDTH;
  canvas.height = DHASH_HEIGHT;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.drawImage(img, 0, 0, DHASH_WIDTH, DHASH_HEIGHT);
  const { data } = ctx.getImageData(0, 0, DHASH_WIDTH, DHASH_HEIGHT);
  const gray = new Uint8Array(DHASH_WIDTH * DHASH_HEIGHT);
  for (let i = 0; i < gray.length; i++) {
    const o = i * 4;
    gray[i] = Math.round(
      0.299 * (data[o] ?? 0) + 0.587 * (data[o + 1] ?? 0) + 0.114 * (data[o + 2] ?? 0),
    );
  }
  return computeDHashFromGrayscale(gray, DHASH_WIDTH, DHASH_HEIGHT);
}
