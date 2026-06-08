import type { ShareOverlaySettings, ShareBackgroundPresetId } from '@/lib/share/types';
import { DEFAULT_SHARE_HEADLINE } from '@/lib/share/types';
import { pnlMomentSnapshot, PNL_MOMENT_DURATION_SEC } from '@/lib/share/pnlMomentMotion';
import { PNL_SHARE_CARD_REF, PNL_SHARE_POS } from '@/lib/share/pnlShareLayout';
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
  periodLabel?: string | null;
  statBoughtLabel?: string | null;
  statSoldLabel?: string | null;
  totalBought?: string | null;
  totalSold?: string | null;
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

/** @deprecated reference PNG removed — no preload needed */
export function preloadPnlShareReference(): Promise<HTMLImageElement | null> {
  return Promise.resolve(null);
}

export function preloadPointerLogoForExport(): Promise<HTMLImageElement | null> {
  return Promise.resolve(null);
}

export const POINTER_BIRD_LOGO_SRC = '/branding/pointer-bird-transparent.png';

function drawCodeBackground(ctx: CanvasRenderingContext2D, w: number, h: number, bgId: ShareBackgroundPresetId) {
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#000000');
  grad.addColorStop(0.45, '#050505');
  grad.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = bgId === 'glacier' ? 0.12 : 0.08;
  const bloom = ctx.createRadialGradient(w * 0.18, h * 0.12, 0, w * 0.18, h * 0.12, w * 0.45);
  bloom.addColorStop(0, bgId === 'glacier' ? '#67e8f9' : '#ffffff');
  bloom.addColorStop(1, 'transparent');
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  ctx.save();
  ctx.translate(w * 0.15, h * 0.2);
  ctx.rotate(-0.42);
  const streak = ctx.createLinearGradient(0, 0, w * 0.55, 0);
  streak.addColorStop(0, 'transparent');
  streak.addColorStop(0.45, 'rgba(255,255,255,0.1)');
  streak.addColorStop(0.52, 'rgba(255,255,255,0.03)');
  streak.addColorStop(1, 'transparent');
  ctx.fillStyle = streak;
  ctx.fillRect(0, 0, w * 0.55, h * 0.55);
  ctx.restore();
}

function drawChromeText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  weight = '800',
) {
  ctx.font = `${weight} ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  const g = ctx.createLinearGradient(x, y - fontSize, x, y);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.45, '#b8bac4');
  g.addColorStop(0.65, '#f0f0f4');
  g.addColorStop(1, '#888890');
  ctx.fillStyle = g;
  ctx.shadowColor = 'rgba(255,255,255,0.25)';
  ctx.shadowBlur = 14;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

function drawGlassBox(ctx: CanvasRenderingContext2D, x: number, y: number, bw: number, bh: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.strokeStyle = 'rgba(255,255,255,0.24)';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = 'rgba(255,255,255,0.08)';
  ctx.shadowBlur = 24;
  roundRect(ctx, x, y, bw, bh, 14);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBirdMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 512, size / 512);
  const path = new Path2D(BIRD_PATH);
  const g = ctx.createLinearGradient(0, 0, 512, 512);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.5, '#d4d4d8');
  g.addColorStop(1, '#fafafa');
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.restore();
}

export function drawPnlCardFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  args: CardFrameArgs,
  overlay: ShareOverlaySettings,
  _refImg: HTMLImageElement | null,
  moment?: { tSec: number } | null,
  options?: { overlayOnly?: boolean },
): void {
  const scale = w / PNL_SHARE_CARD_REF.w;
  const ts = scale * overlay.textScale;
  const bgId = args.backgroundId ?? 'midnight';
  const overlayOnly = options?.overlayOnly === true;
  const pos = PNL_SHARE_POS;

  if (!overlayOnly) {
    drawCodeBackground(ctx, w, h, bgId);
  }

  const rawHandle =
    (args.referralCode || 'pointer').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 18) || 'pointer';
  const handle = `@${rawHandle}`;

  const mainAmt =
    args.amountPrimary ??
    (args.pnlUsd == null
      ? '\u2014'
      : args.pnlUsd >= 0
        ? `+${formatCompactUsd(args.pnlUsd)}`
        : formatCompactUsd(args.pnlUsd));

  const pctStr =
    args.pnlPct == null ? null : `${args.pnlPct >= 0 ? '+' : ''}${args.pnlPct.toFixed(2)}%`;

  const snap =
    moment != null ? pnlMomentSnapshot(moment.tSec) : pnlMomentSnapshot(PNL_MOMENT_DURATION_SEC);
  const heroLabel = formatHeroAmountForMoment(args, mainAmt, moment != null ? snap.countProgress : 1);

  const periodLabel =
    args.periodLabel?.trim() ||
    (args.headlineText ?? DEFAULT_SHARE_HEADLINE).slice(0, 48).trim() ||
    'Realized';

  ctx.textBaseline = 'alphabetic';

  if (overlay.showBranding) {
    drawBirdMark(ctx, pos.logo.x * scale, pos.logo.y * scale, 36 * scale);
    drawChromeText(ctx, 'pointer.', pos.logo.x * scale + 44 * scale, pos.logo.y * scale + 28 * scale, Math.round(28 * ts), '600');
    ctx.textAlign = 'right';
    drawChromeText(ctx, 'x', w - pos.username.right * scale, pos.logo.y * scale + 18 * scale, Math.round(15 * ts), '500');
    drawChromeText(ctx, handle, w - pos.username.right * scale, pos.logo.y * scale + 52 * scale, Math.round(34 * ts), '600');
    ctx.textAlign = 'left';
  }

  drawChromeText(
    ctx,
    periodLabel.toUpperCase(),
    pos.periodHeadline.x * scale,
    pos.periodHeadline.y * scale + pos.periodHeadline.fontSize * ts * 0.85,
    Math.round(pos.periodHeadline.fontSize * ts),
    '900',
  );

  const boxX = pos.heroBox.x * scale;
  const boxY = pos.heroBox.y * scale;
  const boxW = pos.heroBox.w * scale;
  const boxH = pos.heroBox.h * scale;
  drawGlassBox(ctx, boxX, boxY, boxW, boxH);

  ctx.save();
  ctx.globalAlpha *= snap.opacity;
  const token = args.chainTicker || 'USD';
  const parts = heroLabel.split(/\s+/);
  const amountPart = parts.length >= 2 ? parts.slice(0, -1).join(' ') : heroLabel;
  const tokenPart = parts.length >= 2 ? parts[parts.length - 1]! : token;
  drawChromeText(
    ctx,
    amountPart,
    boxX + 32 * scale,
    boxY + boxH * 0.62,
    Math.round(pos.heroAmount.fontSize * ts),
    '900',
  );
  drawChromeText(
    ctx,
    tokenPart.toUpperCase(),
    boxX + 32 * scale + ctx.measureText(amountPart).width + 16 * scale,
    boxY + boxH * 0.62,
    Math.round(42 * ts),
    '700',
  );
  ctx.restore();

  let statY = pos.stats.y * scale;
  const statX = pos.stats.x * scale;
  const statFont = Math.round(pos.stats.fontSize * ts);
  const boughtLabel = args.statBoughtLabel ?? 'Total Bought';
  const soldLabel = args.statSoldLabel ?? 'Total Sold';
  const boughtVal = args.totalBought ?? (args.investedUsd == null ? '\u2014' : formatCompactUsd(args.investedUsd));
  const soldVal = args.totalSold ?? (args.positionUsd == null ? '\u2014' : formatCompactUsd(args.positionUsd));

  if (pctStr) {
    ctx.font = `700 ${statFont}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.fillText('PNL', statX, statY);
    drawChromeText(ctx, pctStr, statX + 280 * scale, statY, statFont, '800');
    statY += pos.stats.rowGap * scale;
  }

  ctx.font = `700 ${statFont}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  ctx.fillText(boughtLabel.toUpperCase(), statX, statY);
  drawChromeText(ctx, boughtVal, statX + 280 * scale, statY, statFont, '800');
  statY += pos.stats.rowGap * scale;

  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  ctx.fillText(soldLabel.toUpperCase(), statX, statY);
  drawChromeText(ctx, soldVal, statX + 280 * scale, statY, statFont, '800');

  if (overlay.showBranding) {
    drawChromeText(ctx, handle, pos.footerHandle.x * scale, pos.footerHandle.y * scale, Math.round(26 * ts), '700');
    ctx.font = `600 ${Math.round(13 * ts)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText('pointer.trade', pos.footerBrand.x * scale, pos.footerBrand.y * scale);
    if (overlay.showCashbackFooter) {
      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      ctx.fillText(
        'Save 50% off fees, the highest in the game.',
        pos.footerBrand.x * scale + ctx.measureText('pointer.trade').width + 20 * scale,
        pos.footerBrand.y * scale,
      );
    }
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
