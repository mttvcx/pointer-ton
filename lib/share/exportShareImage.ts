'use client';

import { toPng } from 'html-to-image';
import { PNL_SHARE_CARD_REF } from '@/lib/share/pnlShareLayout';

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mime = parts[0]?.match(/:(.*?);/)?.[1] ?? 'image/png';
  const bin = atob(parts[1] ?? '');
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: mime });
}

type PngExportOptions = {
  /** Omit or pass `transparent` when compositing over a custom image background. */
  backgroundColor?: string | null;
};

async function renderSharePng(node: HTMLElement, options?: PngExportOptions): Promise<string> {
  return toPng(node, {
    cacheBust: true,
    width: PNL_SHARE_CARD_REF.w,
    height: PNL_SHARE_CARD_REF.h,
    pixelRatio: 2,
    ...(options?.backgroundColor != null ? { backgroundColor: options.backgroundColor } : {}),
  });
}

export async function exportShareImagePng(
  node: HTMLElement,
  filename: string,
  options?: PngExportOptions,
): Promise<void> {
  const dataUrl = await renderSharePng(node, options);
  const blob = dataUrlToBlob(dataUrl);

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyShareImagePng(
  node: HTMLElement,
  options?: PngExportOptions,
): Promise<boolean> {
  const dataUrl = await renderSharePng(node, options);
  const blob = dataUrlToBlob(dataUrl);

  if (!navigator.clipboard || !window.ClipboardItem) {
    return false;
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}
