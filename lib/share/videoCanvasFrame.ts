import type { ShareOverlaySettings, ShareBackgroundPresetId } from '@/lib/share/types';
import { accentHex as pickAccentHex } from '@/lib/share/accentTokens';
import { sharePeriodHeadline, shareUsernameHandle, formatShareSolInteger, formatShareUsdAmount, fitShareHeroFontSize } from '@/lib/share/pnlShareFormat';
import { shareCardTheme } from '@/lib/share/shareCardTheme';
import { pnlMomentSnapshot, PNL_MOMENT_DURATION_SEC } from '@/lib/share/pnlMomentMotion';
import { PNL_SHARE_CARD_REF, PNL_SHARE_POS, pnlShareContentOffset } from '@/lib/share/pnlShareLayout';
import { formatCompactUsd } from '@/lib/utils/formatters';
import { shortenAddress } from '@/lib/utils/addresses';
import { CHAIN_ICON_PNG } from '@/lib/chains/chainAssets';
import type { WalletAnalyticsTimeframe } from '@/lib/wallet-analytics/types';

export { PNL_SHARE_CARD_REF };
export { pickAccentHex as accentHex };

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
  referralCode?: string | null;
  backgroundId?: ShareBackgroundPresetId;
  momentBasis?: { kind: 'usd'; value: number } | { kind: 'sol'; value: number } | null;
  periodLabel?: string | null;
  statBoughtLabel?: string | null;
  statSoldLabel?: string | null;
  totalBought?: string | null;
  totalSold?: string | null;
  shareKind?: 'position' | 'monthly';
  shareHeader?: string | null;
  timeframe?: WalletAnalyticsTimeframe;
};

const BIRD_PATH =
  'M64 376 C 132 308 196 250 264 196 C 230 248 214 286 214 318 C 268 286 322 268 384 256 C 332 280 290 312 248 358 C 304 332 358 320 416 320 C 348 348 286 384 224 432 C 198 404 168 388 132 384 C 108 380 86 380 64 376 Z';

export function preloadPnlShareReference(): Promise<HTMLImageElement | null> {
  return Promise.resolve(null);
}

export function preloadPointerLogoForExport(): Promise<HTMLImageElement | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = '/branding/pointer-bird.png';
  });
}

export const POINTER_BIRD_LOGO_SRC = '/branding/pointer-bird.png';

/** Preload the Solana mark so the hero token can be drawn as the glyph in video exports. */
export function preloadSolLogoForExport(): Promise<HTMLImageElement | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = CHAIN_ICON_PNG.sol;
  });
}

function drawCodeBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bgId: ShareBackgroundPresetId,
  overlayOpacity: number,
) {
  const grad = ctx.createLinearGradient(0, 0, w, h);
  if (bgId === 'glacier') {
    grad.addColorStop(0, '#000203');
    grad.addColorStop(0.45, '#020608');
    grad.addColorStop(1, '#000a0c');
  } else if (bgId === 'onyx') {
    grad.addColorStop(0, '#000000');
    grad.addColorStop(0.45, '#08080a');
    grad.addColorStop(1, '#0c0c0e');
  } else {
    grad.addColorStop(0, '#000000');
    grad.addColorStop(0.45, '#040404');
    grad.addColorStop(1, '#0a0a0a');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = bgId === 'glacier' ? 0.95 : 0.88;
  const bloom = ctx.createRadialGradient(w * 0.18, h * 0.12, 0, w * 0.18, h * 0.12, w * 0.48);
  if (bgId === 'glacier') {
    bloom.addColorStop(0, 'rgba(103,232,249,0.28)');
  } else if (bgId === 'onyx') {
    bloom.addColorStop(0, 'rgba(148,163,184,0.2)');
  } else {
    bloom.addColorStop(0, 'rgba(255,255,255,0.14)');
  }
  bloom.addColorStop(1, 'transparent');
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = Math.min(0.55, overlayOpacity * 0.65);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawGlassBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bw: number,
  bh: number,
  bgId: ShareBackgroundPresetId,
) {
  const cardTheme = shareCardTheme(bgId);
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.strokeStyle = cardTheme.heroBoxBorder;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = cardTheme.heroBoxGlow;
  ctx.shadowBlur = 28;
  roundRect(ctx, x, y, bw, bh, 14);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawChromeText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  weight = '800',
  accentHex?: string,
  bgId: ShareBackgroundPresetId = 'midnight',
) {
  ctx.font = `${weight} ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  const cardTheme = shareCardTheme(bgId);
  const g = ctx.createLinearGradient(x, y - fontSize, x, y);
  if (bgId === 'glacier') {
    g.addColorStop(0, '#f0fdff');
    g.addColorStop(0.45, '#67e8f9');
    g.addColorStop(0.65, '#ecfeff');
    g.addColorStop(1, '#0891b2');
  } else if (bgId === 'onyx') {
    g.addColorStop(0, '#f8fafc');
    g.addColorStop(0.45, '#94a3b8');
    g.addColorStop(0.65, '#e2e8f0');
    g.addColorStop(1, '#64748b');
  } else {
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, '#b8bac4');
    g.addColorStop(0.65, '#f0f0f4');
    g.addColorStop(1, '#888890');
  }
  ctx.fillStyle = g;
  ctx.shadowColor = accentHex ? `${accentHex}66` : cardTheme.heroBoxGlow;
  ctx.shadowBlur = accentHex ? 18 : 16;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

function drawPlainWhiteText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  weight = '600',
) {
  ctx.font = `${weight} ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(255,255,255,0.2)';
  ctx.shadowBlur = 10;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

function drawBirdMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, logoImg: HTMLImageElement | null) {
  if (logoImg) {
    ctx.drawImage(logoImg, x, y, size, size);
    return;
  }
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
  logoImg: HTMLImageElement | null,
  moment?: { tSec: number } | null,
  options?: { overlayOnly?: boolean; solLogo?: HTMLImageElement | null },
): void {
  const scale = w / PNL_SHARE_CARD_REF.w;
  const ts = scale * overlay.textScale;
  const bgId = args.backgroundId ?? 'midnight';
  const overlayOnly = options?.overlayOnly === true;
  const solLogo = options?.solLogo ?? null;
  const pos = PNL_SHARE_POS;
  const accent = args.accentHex;
  const colX = pnlShareContentOffset(overlay.overlayAlign) * scale;

  if (!overlayOnly) {
    drawCodeBackground(ctx, w, h, bgId, overlay.overlayOpacity);
  }

  const handle = shareUsernameHandle(args.walletLabel, args.referralCode);

  const periodLabel =
    args.periodLabel?.trim() ||
    sharePeriodHeadline(args.shareKind ?? 'position', args.shareHeader, args.timeframe ?? '30d');

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

  const showPctStat = overlay.pnlFormat !== 'amount' && pctStr;
  const heroDisplay = overlay.pnlFormat === 'pct' && pctStr ? pctStr : heroLabel;

  ctx.textBaseline = 'alphabetic';

  drawBirdMark(ctx, pos.logo.x * scale, pos.logo.y * scale, pos.logo.birdSize * scale, logoImg);

  ctx.textAlign = 'right';
  drawChromeText(
    ctx,
    'pointer.',
    w - pos.wordmark.right * scale,
    pos.wordmark.y * scale + pos.wordmark.fontSize * 0.85 * scale,
    Math.round(pos.wordmark.fontSize * ts),
    '600',
    accent,
    bgId,
  );
  ctx.textAlign = 'left';

  drawChromeText(
    ctx,
    periodLabel,
    colX,
    pos.periodHeadline.y * scale + pos.periodHeadline.fontSize * ts * 0.85,
    Math.round(pos.periodHeadline.fontSize * ts),
    '900',
    accent,
    bgId,
  );

  const boxX = colX;
  const boxY = pos.heroBox.y * scale;
  const boxW = pos.heroBox.w * scale;
  const boxH = pos.heroBox.h * scale;
  drawGlassBox(ctx, boxX, boxY, boxW, boxH, bgId);

  ctx.save();
  ctx.globalAlpha *= snap.opacity;
  const token = args.chainTicker || 'USD';
  const parts = heroDisplay.split(/\s+/);
  const amountPart = parts.length >= 2 && overlay.pnlFormat !== 'pct' ? parts.slice(0, -1).join(' ') : heroDisplay;
  const tokenPart = parts.length >= 2 && overlay.pnlFormat !== 'pct' ? parts[parts.length - 1]! : token;
  const heroFont = fitShareHeroFontSize(
    amountPart,
    overlay.pnlFormat !== 'pct' && !heroDisplay.includes('%') ? tokenPart : null,
    Math.round(pos.heroAmount.fontSize * ts),
  );
  drawChromeText(ctx, amountPart, boxX + 36 * scale, boxY + boxH * 0.64, heroFont, '900', accent, bgId);
  if (overlay.pnlFormat !== 'pct' && !heroDisplay.includes('%')) {
    const tokenFontPx = Math.round(pos.heroAmount.tokenSize * ts * (heroFont / (pos.heroAmount.fontSize * ts)));
    const tokenX = boxX + 36 * scale + ctx.measureText(amountPart).width + 18 * scale;
    if (tokenPart.toUpperCase() === 'SOL' && solLogo) {
      // Solana glyph instead of the "SOL" text — matches the DOM preview + PNG.
      const iconSize = Math.round(tokenFontPx * 1.02);
      const iconY = boxY + boxH * 0.5 - iconSize / 2;
      ctx.drawImage(solLogo, tokenX, iconY, iconSize, iconSize);
    } else {
      drawChromeText(ctx, tokenPart.toUpperCase(), tokenX, boxY + boxH * 0.64, tokenFontPx, '700', accent, bgId);
    }
  }
  ctx.restore();

  let statY = pos.stats.y * scale;
  const statX = colX;
  const labelFont = Math.round(pos.stats.labelSize * ts);
  const valueFont = Math.round(pos.stats.valueSize * ts);
  const boughtLabel = args.statBoughtLabel ?? 'Total Bought';
  const soldLabel = args.statSoldLabel ?? 'Total Sold';
  const boughtVal = args.totalBought ?? (args.investedUsd == null ? '\u2014' : formatCompactUsd(args.investedUsd));
  const soldVal = args.totalSold ?? (args.positionUsd == null ? '\u2014' : formatCompactUsd(args.positionUsd));

  if (showPctStat) {
    ctx.font = `700 italic ${labelFont}px ui-serif, Georgia, serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('PNL', statX, statY);
    drawChromeText(ctx, pctStr!, statX + pos.stats.labelGap * scale, statY, valueFont, '800', accent, bgId);
    statY += pos.stats.rowGap * scale;
  }

  ctx.font = `700 italic ${labelFont}px ui-serif, Georgia, serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(boughtLabel.toUpperCase(), statX, statY);
  ctx.font = `800 italic ${valueFont}px ui-serif, Georgia, serif`;
  drawChromeText(ctx, boughtVal, statX + pos.stats.labelGap * scale, statY, valueFont, '800', accent, bgId);
  statY += pos.stats.rowGap * scale;

  ctx.font = `700 italic ${labelFont}px ui-serif, Georgia, serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(soldLabel.toUpperCase(), statX, statY);
  ctx.font = `800 italic ${valueFont}px ui-serif, Georgia, serif`;
  drawChromeText(ctx, soldVal, statX + pos.stats.labelGap * scale, statY, valueFont, '800', accent, bgId);

  if (overlay.showWalletAddress) {
    statY += pos.stats.rowGap * scale;
    ctx.fillStyle = 'rgba(255,255,255,0.48)';
    ctx.fillText('WALLET', statX, statY);
    drawChromeText(
      ctx,
      shortenAddress(args.walletAddress, 6),
      statX + pos.stats.labelGap * scale,
      statY,
      valueFont,
      '800',
      accent,
      bgId,
    );
  }

  const cardTheme = shareCardTheme(bgId);
  drawBirdMark(ctx, colX, pos.footerLogo.y * scale, pos.footerLogo.size * scale, logoImg);

  drawChromeText(
    ctx,
    handle,
    colX,
    pos.footerHandle.y * scale,
    Math.round(pos.footerHandle.fontSize * ts),
    '700',
    accent,
    bgId,
  );
  ctx.font = `600 ${Math.round(pos.footerDomain.fontSize * ts)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = cardTheme.accent;
  ctx.fillText('pointer.am', colX, pos.footerDomain.y * scale);
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.font = `500 ${Math.round(pos.footerPromo.fontSize * ts)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText('Save 50% off fees, forever.', colX, pos.footerPromo.y * scale);
}

function formatHeroAmountForMoment(args: CardFrameArgs, fallback: string, progress: number): string {
  const b = args.momentBasis;
  if (!b) return fallback;
  if (b.kind === 'usd') {
    const v = b.value * progress;
    return formatShareUsdAmount(v);
  }
  const v = b.value * progress;
  return formatShareSolInteger(v);
}
