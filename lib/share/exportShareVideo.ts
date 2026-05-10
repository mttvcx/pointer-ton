'use client';

import type { ShareOverlaySettings } from '@/lib/share/types';
import { drawPnlCardFrame, type CardFrameArgs } from '@/lib/share/videoCanvasFrame';

export type VideoExportProgress = (pct: number, label: string) => void;

function waitSeeked(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
  });
}

/**
 * Composite video background + card overlay into WebM using canvas + MediaRecorder.
 */
export async function exportShareVideoWebm(params: {
  videoEl: HTMLVideoElement;
  width: number;
  height: number;
  overlay: ShareOverlaySettings;
  cardArgs: CardFrameArgs;
  maxDurationSec?: number;
  onProgress?: VideoExportProgress;
}): Promise<Blob> {
  const { videoEl, width, height, overlay, cardArgs, maxDurationSec = 28, onProgress } = params;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');

  const metaDur =
    Number.isFinite(videoEl.duration) && videoEl.duration > 0
      ? videoEl.duration
      : maxDurationSec;
  const durationSec = Math.min(maxDurationSec, metaDur);

  const fps = 24;
  const frameDur = 1 / fps;
  const totalFrames = Math.min(Math.ceil(durationSec * fps), Math.ceil(30 * fps));

  const stream = canvas.captureStream(fps);
  const mime =
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const blobPromise = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error('recording_failed'));
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: 'video/webm' }));
    };
  });

  recorder.start(100);

  videoEl.pause();
  videoEl.muted = true;

  async function seekTo(t: number) {
    const clamped = Math.max(0, Math.min(t, durationSec - 0.001));
    if (Math.abs(videoEl.currentTime - clamped) < 0.02) return;
    videoEl.currentTime = clamped;
    await waitSeeked(videoEl);
  }

  for (let frame = 0; frame < totalFrames; frame++) {
    const t = Math.min(frame * frameDur, durationSec - frameDur / 2);
    await seekTo(t);

    ctx.drawImage(videoEl, 0, 0, width, height);
    drawPnlCardFrame(ctx, width, height, cardArgs, overlay);

    onProgress?.(Math.min(99, Math.round(((frame + 1) / totalFrames) * 100)), 'Encoding…');

    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }

  recorder.stop();
  onProgress?.(100, 'Done');
  return await blobPromise;
}
