'use client';

import type { ShareOverlaySettings } from '@/lib/share/types';
import {
  drawPnlCardFrame,
  type CardFrameArgs,
  preloadPointerLogoForExport,
} from '@/lib/share/videoCanvasFrame';

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

/** Single warn if GPU decode returns an empty frame once during export. */
let videoBlankFrameWarned = false;

function drawVideoCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  pan: { x: number; y: number },
  zoom: number,
): void {
  const vw = video.videoWidth || width;
  const vh = video.videoHeight || height;
  if (vw < 2 || vh < 2) {
    if (!videoBlankFrameWarned) {
      videoBlankFrameWarned = true;
      console.warn('[share-video] Video dimensions unavailable; drawing black frame until metadata is ready');
    }
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    return;
  }
  const safeZoom = Math.max(1, Math.min(3, zoom || 1));
  const coverScale = Math.max(width / vw, height / vh);
  const sw = Math.min(vw, width / (coverScale * safeZoom));
  const sh = Math.min(vh, height / (coverScale * safeZoom));
  const maxX = Math.max(0, (vw - sw) / 2);
  const maxY = Math.max(0, (vh - sh) / 2);
  const sx = (vw - sw) / 2 + (Math.max(-50, Math.min(50, pan.x)) / 50) * maxX;
  const sy = (vh - sh) / 2 + (Math.max(-50, Math.min(50, pan.y)) / 50) * maxY;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);
}

function pickRecorderMime(): string {
  if (typeof MediaRecorder === 'undefined') return 'video/webm';
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=h264,aac',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm',
  ];
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) ?? 'video/webm';
}

function mergeCanvasAndVideoAudio(canvasStream: MediaStream, video: HTMLVideoElement): MediaStream {
  const out = new MediaStream();
  for (const t of canvasStream.getVideoTracks()) out.addTrack(t);
  const cap = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.call(
    video,
  );
  for (const t of cap?.getAudioTracks() ?? []) {
    out.addTrack(t);
  }
  return out;
}

/**
 * Export duration policy:
 * - Uses the shorter of (user cap) and (background metadata duration) so we never encode past real media.
 * - If metadata is missing/Infinity, fall back to the cap only (caller should load metadata first).
 * - Looping: preview uses looping video; export encodes one pass through [0, durationSec). If the file
 *   is shorter than the cap, the encoded length follows the file (not silent freeze-pad).
 */
function computeExportDuration(
  videoEl: HTMLVideoElement,
  maxDurationSec: number,
): { durationSec: number; metaDur: number } {
  const metaRaw = videoEl.duration;
  const metaDur = Number.isFinite(metaRaw) && metaRaw > 0 ? metaRaw : 0;
  if (metaDur <= 0) {
    return { durationSec: Math.max(0.1, maxDurationSec), metaDur: 0 };
  }
  const durationSec = Math.min(maxDurationSec, metaDur);
  return { durationSec, metaDur };
}

async function seekToTime(videoEl: HTMLVideoElement, t: number, durationSec: number): Promise<void> {
  const clamped = Math.max(0, Math.min(t, Math.max(durationSec - 0.001, 0)));
  if (Math.abs(videoEl.currentTime - clamped) < 0.001) return;
  videoEl.currentTime = clamped;
  await waitSeeked(videoEl);
}

/**
 * Composite video background + card overlay into a browser-supported video container.
 * Prefers MP4 where MediaRecorder supports it, otherwise falls back to WebM.
 */
export async function exportShareVideoWebm(params: {
  videoEl: HTMLVideoElement;
  width: number;
  height: number;
  overlay: ShareOverlaySettings;
  cardArgs: CardFrameArgs;
  maxDurationSec?: number;
  videoPan?: { x: number; y: number };
  videoZoom?: number;
  /** When true, no audio tracks are muxed (matches Sound off). */
  muted?: boolean;
  onProgress?: VideoExportProgress;
}): Promise<Blob> {
  const {
    videoEl,
    width,
    height,
    overlay,
    cardArgs,
    maxDurationSec = 30,
    videoPan = { x: 0, y: 0 },
    videoZoom = 1,
    muted = false,
    onProgress,
  } = params;

  videoBlankFrameWarned = false;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');

  const { durationSec, metaDur } = computeExportDuration(videoEl, maxDurationSec);

  const fps = 30;
  const frameMs = 1000 / fps;

  const logoBird = await preloadPointerLogoForExport();

  const drawFrame = (momentT: number) => {
    drawVideoCover(ctx, videoEl, width, height, videoPan, videoZoom);
    drawPnlCardFrame(ctx, width, height, cardArgs, overlay, logoBird, { tSec: momentT });
  };

  const canvasStream = canvas.captureStream(fps);
  const stream = muted ? canvasStream : mergeCanvasAndVideoAudio(canvasStream, videoEl);
  const mime = pickRecorderMime();

  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const blobPromise = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error('recording_failed'));
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mime }));
    };
  });

  recorder.start(100);

  /**
   * Sound off — deterministic frame-by-frame seek at 30fps (no reliance on real-time playback).
   * Avoids decoder stalls that commonly hit 1×1 off-screen `<video>` elements.
   */
  if (muted) {
    videoEl.muted = true;
    videoEl.loop = false;
    videoEl.pause();

    await seekToTime(videoEl, 0, durationSec);

    const totalFrames = Math.max(1, Math.round(durationSec * fps));

    for (let i = 0; i < totalFrames; i++) {
      const tLinear = i / fps;
      /* If we must cap below file length, stay in range; otherwise modulo when policy demands loop (here: no loop). */
      const t = metaDur > 0 ? Math.min(tLinear, durationSec - 1e-3) : tLinear;
      await seekToTime(videoEl, t, durationSec);
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      drawFrame(tLinear);
      onProgress?.(Math.min(99, Math.round(((i + 1) / totalFrames) * 100)), 'Encoding...');
      await new Promise<void>((r) => setTimeout(r, frameMs));
    }

    await seekToTime(videoEl, Math.max(0, durationSec - 0.02), durationSec);
    drawFrame(durationSec);
    videoEl.pause();
    recorder.stop();
    onProgress?.(100, 'Done');
    return await blobPromise;
  }

  /**
   * Sound on — real-time playback so audio stays continuous; large off-screen element avoids throttle.
   */
  videoEl.muted = false;
  videoEl.loop = false;
  videoEl.pause();

  const startedAt = performance.now();

  await seekToTime(videoEl, 0, durationSec);
  await videoEl.play().catch(() => {});

  await new Promise<void>((resolve) => {
    const draw = () => {
      const tVid = videoEl.currentTime;
      const elapsedWall = (performance.now() - startedAt) / 1000;

      const reachedEnd =
        tVid >= durationSec - 0.05 || videoEl.ended || (metaDur > 0 && tVid >= metaDur - 0.05);
      const wallTimeout = elapsedWall > durationSec + 3;

      if (reachedEnd || wallTimeout) {
        resolve();
        return;
      }

      drawFrame(tVid);
      onProgress?.(Math.min(99, Math.round((tVid / durationSec) * 100)), 'Encoding...');
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  });

  videoEl.pause();
  drawFrame(Math.min(durationSec, videoEl.currentTime || durationSec));
  recorder.stop();
  onProgress?.(100, 'Done');
  return await blobPromise;
}
