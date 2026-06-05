import type { ShareOverlaySettings, ShareBackgroundPresetId } from '@/lib/share/types';
import { DEFAULT_SHARE_HEADLINE } from '@/lib/share/types';
import { pnlMomentSnapshot, PNL_MOMENT_DURATION_SEC } from '@/lib/share/pnlMomentMotion';
import {
  PNL_SHARE_CARD_REF,
  PNL_SHARE_COVER,
  PNL_SHARE_POS,
  PNL_SHARE_REFERENCE_IMG,
  PNL_SHARE_PRESET_FILTERS,
} from '@/lib/share/pnlShareLayout';
import {
  PNL_SHARE_NEG_COLOR,
  PNL_SHARE_POS_COLOR,
} from '@/lib/share/shareCardTheme';
import { formatCompactUsd } from '@/lib/utils/formatters';

export { PNL_SHARE_CARD_REF };

export type CardFrameArgs = {
  ticker: string;
  tokenName: string | null;
  pnlUsd: number | null;
  pnlPct: number | null;
  investedUsd: number | null;
  positionUsd: number | null;
  walletLabel: string | null;
  walletAddress: string;
  accentHex: string;
  chainTicker: string;
  amountPrimary?: string | null;
  headlineText?: string | null;
  referralCode?: string | null;
  backgroundId?: ShareBackgroundPresetId;
  momentBasis?: { kind: 'usd'; value: number } | { kind: 'sol'; value: number } | null;
};

const ACCENT: Record<ShareOverlaySettings['accent'], string> = {
  teal: '#2dd4bf',
  purple: '#c084fc',
  blue: '#60a5fa',
  green: '#4ade80',
};

export function accentHex(accent: ShareOverlaySettings['accent']): string {
  return ACCENT[accent];
}

const BIRD_PATH =
  'M64 376 C 132 308 196 250 264 196 C 230 248 214 286 214 318 C 268 286 322 268 384 256 C 332 280 290 312 248 358 C 304 332 358 320 416 320 C 348 348 286 384 224 432 C 198 404 168 388 132 384 C 108 380 86 380 64 376 Z';

let refLoadWarned = false;

export function preloadPnlShareReference(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      if (!refLoadWarned) {
        refLoadWarned = true;
        console.warn('[share-video] PNL reference card failed to load');
      }
      resolve(null);
    };
    img.src = PNL_SHARE_REFERENCE_IMG;
  });
}

/** @deprecated use preloadPnlShareReference */
export function preloadPointerLogoForExport(): Promise<HTMLImageElement | null> {
  return preloadPnlShareReference();
}

export const POINTER_BIRD_LOGO_SRC = PNL_SHARE_REFERENCE_IMG;

function paletteFor(id: ShareBackgroundPresetId | undefined) {
  const bg = id ?? 'midnight';
  const accent =
    bg === 'glacier' ? '#a5f3fc' : bg === 'onyx' ? '#cbd5e1' : '#c4b5fd';
  const birdRim = bg === 'glacier' ? '#5cf2ff' : bg === 'onyx' ? '#cdd5e2' : '#8a6bff';
  return { accent, birdRim, birdInner: '#0c0820', birdRim2: '#c2a8ff' };
}

function drawCover(ctx: CanvasRenderingContext2D, box: (typeof PNL_SHARE_COVER)[keyof typeof PNL_SHARE_COVER], scale: number) {
  ctx.fillStyle = box.color;
  ctx.fillRect(box.x * scale, box.y * scale, box.w * scale, box.h * scale);
}

function drawBirdOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  id: ShareBackgroundPresetId | undefined,
) {
  const p = paletteFor(id);
  const scale = w / PNL_SHARE_CARD_REF.w;
  const birdSize = Math.min(h * 1.22, w * 0.72);
  const cx = w * 0.79;
  const cy = h * 0.5;

  ctx.save();
  ctx.translate(cx - birdSize / 2, cy - birdSize / 2);
  ctx.scale(birdSize / 512, birdSize / 512);
  const path = new Path2D(BIRD_PATH);
  ctx.fillStyle = p.birdRim;
  ctx.shadowColor = p.birdRim;
  ctx.shadowBlur = 70;
  ctx.globalAlpha = 0.32;
  ctx.fill(path);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  const grad = ctx.createLinearGradient(0, 0, 480, 480);
  grad.addColorStop(0, p.birdInner);
  grad.addColorStop(1, '#000');
  ctx.fillStyle = grad;
  ctx.fill(path);
  ctx.strokeStyle = p.birdRim;
  ctx.lineWidth = 4;
  ctx.shadowColor = p.birdRim;
  ctx.shadowBlur = 16;
  ctx.globalAlpha = 0.85;
  ctx.stroke(path);
  ctx.restore();
}

export function drawPnlCardFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  args: CardFrameArgs,
  overlay: ShareOverlaySettings,
  refImg: HTMLImageElement | null,
  moment?: { tSec: number } | null,
  options?: { overlayOnly?: boolean },
): void {
  const scale = w / PNL_SHARE_CARD_REF.w;
  const ts = scale * overlay.textScale;
  const palette = paletteFor(args.backgroundId);
  const overlayOnly = options?.overlayOnly === true;
  const bgId = args.backgroundId ?? 'midnight';

  if (!overlayOnly && refImg) {
    const filter = PNL_SHARE_PRESET_FILTERS[bgId];
    ctx.save();
    if (filter) ctx.filter = filter;
    ctx.drawImage(refImg, 0, 0, w, h);
    ctx.filter = 'none';
    ctx.restore();

    if (overlay.showCashbackFooter) drawCover(ctx, PNL_SHARE_COVER.headline, scale);
    drawCover(ctx, PNL_SHARE_COVER.ticker, scale);
    if (overlay.showTokenName && args.tokenName) drawCover(ctx, PNL_SHARE_COVER.tokenName, scale);
    drawCover(ctx, PNL_SHARE_COVER.heroAmount, scale);
    drawCover(ctx, PNL_SHARE_COVER.stats, scale);
    drawCover(ctx, PNL_SHARE_COVER.footerUrl, scale);
    if (overlay.showBranding) drawCover(ctx, PNL_SHARE_COVER.footerHandle, scale);
  } else if (!overlayOnly) {
    ctx.fillStyle = '#05000a';
    ctx.fillRect(0, 0, w, h);
  } else {
    drawBirdOverlay(ctx, w, h, bgId);
  }

  const headlineRaw = (args.headlineText ?? DEFAULT_SHARE_HEADLINE).slice(0, 72);
  const headline = headlineRaw.toUpperCase();
  const rawHandle =
    (args.referralCode || 'pointer').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 18) || 'pointer';
  const handle = `@${rawHandle}`;
  const ticker = (args.ticker || 'TOKEN').replace(/^\$+/, '').slice(0, 18).toUpperCase();

  const mainAmt =
    args.amountPrimary ??
    (args.pnlUsd == null
      ? '\u2014'
      : args.pnlUsd >= 0
        ? `+${formatCompactUsd(args.pnlUsd)}`
        : formatCompactUsd(args.pnlUsd));

  const pctStr =
    args.pnlPct == null ? null : `${args.pnlPct >= 0 ? '+' : ''}${args.pnlPct.toFixed(2)}%`;

  const pos = args.pnlUsd != null && args.pnlUsd >= 0;
  const pnlColor = pos ? PNL_SHARE_POS_COLOR : PNL_SHARE_NEG_COLOR;

  const snap =
    moment != null ? pnlMomentSnapshot(moment.tSec) : pnlMomentSnapshot(PNL_MOMENT_DURATION_SEC);
  const heroLabel = formatHeroAmountForMoment(args, mainAmt, moment != null ? snap.countProgress : 1);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  if (overlay.showCashbackFooter && headline.trim()) {
    ctx.font = `800 ${Math.round(11 * ts)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(248,250,252,0.9)';
    ctx.fillText(headline, PNL_SHARE_POS.headline.x * scale, (PNL_SHARE_POS.headline.y + 14) * scale);
  }

  ctx.font = `900 ${Math.round(PNL_SHARE_POS.ticker.fontSize * ts)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(ticker, PNL_SHARE_POS.ticker.x * scale, PNL_SHARE_POS.ticker.y * scale);

  if (overlay.showTokenName && args.tokenName) {
    ctx.font = `700 ${Math.round(PNL_SHARE_POS.tokenName.fontSize * ts)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = palette.accent;
    ctx.fillText(
      args.tokenName.slice(0, 28).toUpperCase(),
      PNL_SHARE_POS.tokenName.x * scale,
      PNL_SHARE_POS.tokenName.y * scale,
    );
  }

  ctx.save();
  ctx.globalAlpha *= snap.opacity;
  ctx.font = `900 ${Math.round(PNL_SHARE_POS.heroAmount.fontSize * ts)}px ui-sans-serif, system-ui, sans-serif`;
  const hx = PNL_SHARE_POS.heroAmount.x * scale;
  const hy = PNL_SHARE_POS.heroAmount.y * scale;
  const hw = ctx.measureText(heroLabel).width;
  const hcx = hx + hw / 2;
  const hcy = hy - PNL_SHARE_POS.heroAmount.fontSize * ts * 0.35;
  ctx.shadowColor = pnlColor;
  ctx.shadowBlur = 18 + 30 * snap.glowStrength;
  ctx.fillStyle = pnlColor;
  ctx.translate(hcx, hcy);
  ctx.scale(snap.scale, snap.scale);
  ctx.translate(-hcx, -hcy);
  ctx.fillText(heroLabel, hx, hy);
  ctx.restore();

  const statX = PNL_SHARE_POS.stats.x * scale;
  let statY = PNL_SHARE_POS.stats.y * scale;
  const statFont = Math.round(PNL_SHARE_POS.stats.fontSize * ts);
  const valX = statX + Math.round(PNL_SHARE_POS.stats.labelGap * ts);

  ctx.font = `700 ${statFont}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('PNL', statX, statY);
  ctx.font = `800 ${statFont}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = pnlColor;
  ctx.fillText(heroLabel, valX, statY);
  if (pctStr) {
    const lw = ctx.measureText(heroLabel).width;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `600 ${statFont}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(`   (${pctStr})`, valX + lw, statY);
  }

  if (!overlay.compactStats) {
    statY += PNL_SHARE_POS.stats.rowH * scale;
    ctx.font = `700 ${statFont}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('INVESTED', statX, statY);
    ctx.font = `800 ${statFont}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(
      args.investedUsd == null ? '\u2014' : formatCompactUsd(args.investedUsd),
      valX,
      statY,
    );

    statY += PNL_SHARE_POS.stats.rowH * scale;
    ctx.font = `700 ${statFont}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('POSITION', statX, statY);
    ctx.font = `800 ${statFont}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(
      args.positionUsd == null ? '\u2014' : formatCompactUsd(args.positionUsd),
      valX,
      statY,
    );
  }

  ctx.font = `800 ${Math.round(PNL_SHARE_POS.footerUrl.fontSize * ts)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = palette.accent;
  ctx.fillText(
    `POINTER.TRADE/${rawHandle.toLowerCase()}`,
    PNL_SHARE_POS.footerUrl.x * scale,
    PNL_SHARE_POS.footerUrl.y * scale,
  );

  if (overlay.showBranding) {
    ctx.textAlign = 'right';
    ctx.font = `700 ${Math.round(PNL_SHARE_POS.footerHandle.fontSize * ts)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = palette.accent;
    ctx.fillText(handle, PNL_SHARE_POS.footerHandle.x * scale, PNL_SHARE_POS.footerHandle.y * scale);
    ctx.textAlign = 'left';
  }
}

function formatHeroAmountForMoment(args: CardFrameArgs, fallback: string, progress: number): string {
  const b = args.momentBasis;
  if (!b) return fallback;
  if (b.kind === 'usd') {
    const v = b.value * progress;
    return v >= 0 ? `+${formatCompactUsd(v)}` : formatCompactUsd(v);
  }
  const v = b.value * progress;
  const sign = v >= 0 ? '+' : '-';
  return `${sign}${Math.abs(v).toFixed(3)} SOL`;
}
