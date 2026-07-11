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
    // The live node is visually shrunk via `transform: scale(fitScale)` to fit the
    // modal. Capture at its NATIVE 1920×1080 (not shrunk into the corner).
    style: { transform: 'none', transformOrigin: 'top left' },
    filter: (el) => (el as HTMLElement).dataset?.pnlDrag !== '1',
    ...(options?.backgroundColor != null ? { backgroundColor: options.backgroundColor } : {}),
  });
}

/**
 * Snapshot the REAL card node (the same one the image export + preview use) as a
 * TRANSPARENT overlay — the `<video>`/`<img>` background is filtered out so only
 * the card chrome (logo, PNL box, stats, footer, background gradient) is captured.
 * The video exporter composites this over each moving frame, guaranteeing the
 * export is pixel-identical to the maker instead of a hand-drawn reimplementation.
 */
export async function renderCardOverlayImage(node: HTMLElement): Promise<HTMLImageElement> {
  const dataUrl = await toPng(node, {
    cacheBust: true,
    width: PNL_SHARE_CARD_REF.w,
    height: PNL_SHARE_CARD_REF.h,
    pixelRatio: 1,
    // Capture at NATIVE 1920×1080 — the live node is shrunk via transform:scale to
    // fit the modal; without this the card renders tiny in the corner of the frame.
    style: { transform: 'none', transformOrigin: 'top left' },
    // No backgroundColor → transparent. Drop the <video> background + the drag
    // layer (video export draws the real moving video beneath the overlay).
    filter: (el) => (el as HTMLElement).tagName !== 'VIDEO' && (el as HTMLElement).dataset?.pnlDrag !== '1',
  });
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  return img;
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
