import type { ShareOverlaySettings, ShareBackgroundPresetId } from '@/lib/share/types';
import { DEFAULT_SHARE_HEADLINE } from '@/lib/share/types';
import { pnlMomentSnapshot, PNL_MOMENT_DURATION_SEC } from '@/lib/share/pnlMomentMotion';
import { formatCompactUsd } from '@/lib/utils/formatters';

/** Layout reference matches `PnlShareCard` at a 1280×720 (16:9) design size. */
export const PNL_SHARE_CARD_REF = { w: 1280, h: 720 };

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
  /** Passed through for parity with composer payload; reserved for future chain-specific labels. */
  chainTicker: string;
  amountPrimary?: string | null;
  headlineText?: string | null;
  referralCode?: string | null;
  backgroundId?: ShareBackgroundPresetId;
  /** When set, hero amount interpolates and emphasizes over {@link PNL_MOMENT_DURATION_SEC}s */
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

export const POINTER_BIRD_LOGO_SRC = '/branding/logo-bird.svg';

let logoLoadWarned = false;

/**
 * Preload the real Pointer bird mark for canvas export (mirrors `PnlShareCard` img src).
 * On failure, export falls back to a stylised silhouette drawn from canvas paths.
 */
export function preloadPointerLogoForExport(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      if (!logoLoadWarned) {
        logoLoadWarned = true;
        console.warn('[share-video] Pointer logo failed to load; using vector fallback');
      }
      resolve(null);
    };
    img.src = POINTER_BIRD_LOGO_SRC;
  });
}

type Palette = {
  bg1: string;
  bg2: string;
  halo: string;
  birdInner: string;
  birdRim: string;
  birdRim2: string;
  wordmark: string;
  wordmarkStroke: string;
  nameTone: string;
};

function paletteFor(id: ShareBackgroundPresetId | undefined): Palette {
  if (id === 'glacier') {
    return {
      bg1: '#04080d',
      bg2: '#03060a',
      halo: 'rgba(34,211,238,0.22)',
      birdInner: '#0a0c14',
      birdRim: '#5cf2ff',
      birdRim2: '#9efcff',
      wordmark: 'rgba(158,252,255,0.05)',
      wordmarkStroke: 'rgba(158,252,255,0.18)',
      nameTone: '#a5f3fc',
    };
  }
  if (id === 'onyx') {
    return {
      bg1: '#04060a',
      bg2: '#020306',
      halo: 'rgba(255,255,255,0.06)',
      birdInner: '#0a0c14',
      birdRim: '#cdd5e2',
      birdRim2: '#f4f6fa',
      wordmark: 'rgba(203,213,225,0.04)',
      wordmarkStroke: 'rgba(203,213,225,0.16)',
      nameTone: '#cbd5e1',
    };
  }
  return {
    bg1: '#030208',
    bg2: '#020106',
    halo: 'rgba(124,58,237,0.32)',
    birdInner: '#0c0820',
    birdRim: '#8a6bff',
    birdRim2: '#c2a8ff',
    wordmark: 'rgba(138,107,255,0.05)',
    wordmarkStroke: 'rgba(168,139,255,0.2)',
    nameTone: '#c4b5fd',
  };
}

function fillBackground(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette) {
  const lin = ctx.createLinearGradient(0, 0, 0, h);
  lin.addColorStop(0, p.bg1);
  lin.addColorStop(1, p.bg2);
  ctx.fillStyle = lin;
  ctx.fillRect(0, 0, w, h);

  const rg = ctx.createRadialGradient(w * 0.8, h * 0.38, 0, w * 0.8, h * 0.38, Math.max(w, h) * 0.68);
  rg.addColorStop(0, p.halo);
  rg.addColorStop(0.55, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);

  const rg2 = ctx.createRadialGradient(w * 0.12, h * 0.88, 0, w * 0.12, h * 0.88, Math.max(w, h) * 0.5);
  rg2.addColorStop(0, 'rgba(76,29,149,0.22)');
  rg2.addColorStop(0.6, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg2;
  ctx.fillRect(0, 0, w, h);

  /* Inset vignette */
  ctx.save();
  ctx.globalAlpha = 0.7;
  const inset = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.95);
  inset.addColorStop(0, 'rgba(0,0,0,0)');
  inset.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = inset;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawGeoPattern(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette) {
  ctx.save();
  ctx.strokeStyle = p.wordmarkStroke;
  ctx.globalAlpha = 0.35;
  const cell = 48 * (w / PNL_SHARE_CARD_REF.w);
  for (let x = 0; x < w; x += cell) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += cell) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.45;
  const marks: [number, number][] = [
    [0.17, 0.19],
    [0.27, 0.31],
    [0.75, 0.25],
    [0.81, 0.44],
    [0.14, 0.67],
    [0.69, 0.78],
  ];
  for (const [fx, fy] of marks) {
    const x = w * fx;
    const y = h * fy;
    const s = 6 * (w / PNL_SHARE_CARD_REF.w);
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.lineTo(x + s, y);
    ctx.moveTo(x, y - s);
    ctx.lineTo(x, y + s);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPurpleFrame(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette) {
  ctx.save();
  ctx.strokeStyle = p.birdRim;
  ctx.globalAlpha = 0.72;
  ctx.lineWidth = Math.max(2, w * 0.0016);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  ctx.restore();
}

/* Bird path matches the silhouette used in PointerNeonBird. */
const BIRD_PATH =
  'M64 376 C 132 308 196 250 264 196 C 230 248 214 286 214 318 C 268 286 322 268 384 256 C 332 280 290 312 248 358 C 304 332 358 320 416 320 C 348 348 286 384 224 432 C 198 404 168 388 132 384 C 108 380 86 380 64 376 Z';

function drawBird(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  p: Palette,
  opacity = 1,
): void {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 512, size / 512);

  const path = new Path2D(BIRD_PATH);

  /* Soft halo behind */
  ctx.save();
  ctx.fillStyle = p.birdRim;
  ctx.globalAlpha = 0.32 * opacity;
  ctx.shadowColor = p.birdRim;
  ctx.shadowBlur = 70;
  ctx.fill(path);
  ctx.restore();

  /* Body */
  const grad = ctx.createLinearGradient(0, 0, 480, 480);
  grad.addColorStop(0, p.birdInner);
  grad.addColorStop(1, '#000000');
  ctx.fillStyle = grad;
  ctx.fill(path);

  /* Rim glow */
  ctx.save();
  ctx.strokeStyle = p.birdRim;
  ctx.lineWidth = 4;
  ctx.shadowColor = p.birdRim;
  ctx.shadowBlur = 16;
  ctx.globalAlpha = 0.85 * opacity;
  ctx.stroke(path);
  ctx.restore();

  /* Bright highlight rim */
  ctx.save();
  ctx.strokeStyle = p.birdRim2;
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = 0.7 * opacity;
  ctx.stroke(path);
  ctx.restore();

  ctx.restore();
}

function drawBackdropWordmark(
  ctx: CanvasRenderingContext2D,
  w: number,
  _h: number,
  topY: number,
  p: Palette,
) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontPx = Math.round(w * 0.178);
  ctx.font = `900 ${fontPx}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = p.wordmark;
  ctx.strokeStyle = p.wordmarkStroke;
  ctx.lineWidth = 1.4;
  ctx.fillText('POINTER', w / 2, topY);
  ctx.strokeText('POINTER', w / 2, topY);

  ctx.textAlign = 'start';
  ctx.font = `800 ${Math.round(w * 0.027)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = p.nameTone;
  ctx.fillText('• TRADE', w * 0.72, topY + fontPx * 0.32);
  ctx.restore();
}

export function drawPnlCardFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  args: CardFrameArgs,
  overlay: ShareOverlaySettings,
  logoBird: HTMLImageElement | null,
  moment?: { tSec: number } | null,
): void {
  const ts = (w / PNL_SHARE_CARD_REF.w) * overlay.textScale;
  const padX = w * 0.044;
  const padY = h * 0.046;

  const palette = paletteFor(args.backgroundId);
  fillBackground(ctx, w, h, palette);
  drawGeoPattern(ctx, w, h, palette);

  /* Faded backdrop wordmark */
  drawBackdropWordmark(ctx, w, h, h * 0.17, palette);

  /* Right-side hero bird */
  const birdSize = Math.min(h * 1.22, w * 0.72);
  drawBird(ctx, w * 0.79, h * 0.5, birdSize, palette, 0.98);

  drawPurpleFrame(ctx, w, h, palette);

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
    args.pnlPct == null
      ? null
      : `${args.pnlPct >= 0 ? '+' : ''}${args.pnlPct.toFixed(2)}%`;

  const pos = args.pnlUsd != null && args.pnlUsd >= 0;
  const pnlColor = pos ? '#3DDC97' : '#FF5E78';

  const snap =
    moment != null ? pnlMomentSnapshot(moment.tSec) : pnlMomentSnapshot(PNL_MOMENT_DURATION_SEC);
  const mainAmtProgress = moment != null ? snap.countProgress : 1;
  const heroLabel = formatHeroAmountForMoment(args, mainAmt, mainAmtProgress);

  /* --- Top brand bar (left) --- */
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const brandY = padY + 14 * ts;
  const brandBirdSize = Math.round(30 * ts);
  drawBird(ctx, padX + brandBirdSize / 2, brandY, brandBirdSize, palette, 1);
  const brandFontPx = Math.round(17 * ts);
  ctx.font = `800 ${brandFontPx}px ui-sans-serif, system-ui, sans-serif`;
  const brandTextX = padX + brandBirdSize + Math.round(10 * ts);
  ctx.fillStyle = 'rgba(248,250,252,0.98)';
  ctx.fillText('POINTER', brandTextX, brandY + Math.round(5 * ts));
  const pointerW = ctx.measureText('POINTER').width;
  ctx.fillStyle = palette.nameTone;
  ctx.fillText('.TRADE', brandTextX + pointerW, brandY + Math.round(5 * ts));

  /* --- Headline pill --- */
  if (overlay.showCashbackFooter && headline.trim()) {
    const pillFontPx = Math.round(13 * ts);
    ctx.font = `800 ${pillFontPx}px ui-sans-serif, system-ui, sans-serif`;
    const tw = ctx.measureText(headline).width;
    const pillX = padX;
    const pillY = brandY + Math.round(28 * ts);
    const pillH = Math.round(34 * ts);
    const pillPadX = Math.round(14 * ts);
    const dotR = Math.max(3, Math.round(3 * ts));
    const pillW = tw + pillPadX * 2 + dotR * 2 + Math.round(8 * ts);

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    roundRectPath(ctx, pillX, pillY, pillW, pillH, Math.round(8 * ts));
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = palette.nameTone;
    ctx.beginPath();
    ctx.arc(pillX + pillPadX + dotR, pillY + pillH / 2, dotR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(248,250,252,0.9)';
    ctx.font = `800 ${pillFontPx}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(headline, pillX + pillPadX + dotR * 2 + Math.round(8 * ts), pillY + pillH / 2);
    ctx.textBaseline = 'alphabetic';
  }

  /* --- Ticker --- */
  const tickerY = h * 0.42;
  const tickerSize = Math.round(Math.min(96, Math.max(46, w * 0.07)) * ts);
  ctx.font = `900 ${tickerSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(ticker, padX, tickerY);

  let nameY = tickerY + Math.round(28 * ts);
  if (overlay.showTokenName && args.tokenName) {
    ctx.font = `700 ${Math.round(15 * ts)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = palette.nameTone;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillText(args.tokenName.slice(0, 28).toUpperCase(), padX, nameY);
    ctx.restore();
    nameY += Math.round(8 * ts);
  }

  /* --- PnL hero box --- */
  const boxFontPx = Math.round(Math.min(62, Math.max(36, w * 0.046)) * ts);
  ctx.font = `900 ${boxFontPx}px ui-sans-serif, system-ui, sans-serif`;
  const labelW = ctx.measureText(heroLabel).width;
  const boxPadX = Math.round(28 * ts);
  const boxW = Math.max(Math.round(420 * ts), labelW + boxPadX * 2);
  const boxH = Math.round(86 * ts);
  const boxX = padX;
  const boxY = nameY + Math.round(18 * ts);

  /* Box bg */
  const boxGrad = ctx.createLinearGradient(0, boxY, 0, boxY + boxH);
  boxGrad.addColorStop(0, 'rgba(8,11,18,0.92)');
  boxGrad.addColorStop(1, 'rgba(4,6,11,0.92)');
  ctx.fillStyle = boxGrad;
  roundRectPath(ctx, boxX, boxY, boxW, boxH, Math.round(12 * ts));
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.085)';
  ctx.lineWidth = 1;
  roundRectPath(ctx, boxX, boxY, boxW, boxH, Math.round(12 * ts));
  ctx.stroke();

  /* Hero amount with motion */
  ctx.save();
  ctx.globalAlpha *= snap.opacity;
  const tyBase = boxY + boxH * 0.66;
  const txBase = boxX + boxPadX;
  const cx = txBase + labelW / 2;
  const cy = tyBase - boxFontPx * 0.32;
  ctx.shadowColor = pnlColor;
  ctx.shadowBlur = 18 + 30 * snap.glowStrength + snap.blurPx * 0.9;
  ctx.fillStyle = pnlColor;
  ctx.translate(cx, cy);
  ctx.scale(snap.scale, snap.scale);
  ctx.translate(-cx, -cy);
  ctx.textAlign = 'left';
  ctx.fillText(heroLabel, txBase, tyBase);
  ctx.restore();
  ctx.shadowBlur = 0;

  /* Hairline under amount + dot */
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(boxX + boxPadX * 0.5, boxY + boxH - Math.round(10 * ts));
  ctx.lineTo(boxX + boxW - boxPadX * 0.5, boxY + boxH - Math.round(10 * ts));
  ctx.stroke();
  ctx.beginPath();
  ctx.fillStyle = pnlColor;
  ctx.shadowColor = pnlColor;
  ctx.shadowBlur = 8;
  ctx.arc(
    boxX + boxW / 2,
    boxY + boxH - Math.round(10 * ts),
    Math.max(3, Math.round(3 * ts)),
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.shadowBlur = 0;

  /* --- Stats grid --- */
  const statY0 = boxY + boxH + Math.round(36 * ts);
  const labelFontPx = Math.round(16 * ts);
  const valueFontPx = Math.round(18 * ts);
  const rowH = Math.round(30 * ts);
  const colGap = Math.round(48 * ts);
  ctx.textBaseline = 'alphabetic';

  let widestLabel = 0;
  ['PNL', 'INVESTED', 'POSITION'].forEach((s) => {
    ctx.font = `700 ${labelFontPx}px ui-sans-serif, system-ui, sans-serif`;
    widestLabel = Math.max(widestLabel, ctx.measureText(s).width);
  });
  const valueX = padX + widestLabel + colGap;

  ctx.font = `700 ${labelFontPx}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('PNL', padX, statY0);
  ctx.font = `800 ${valueFontPx}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = pnlColor;
  const pnlValueText = pctStr ? `${heroLabel}   (${pctStr})` : heroLabel;
  /* Render value first, then dim pct */
  ctx.fillText(heroLabel, valueX, statY0);
  if (pctStr) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `600 ${valueFontPx}px ui-sans-serif, system-ui, sans-serif`;
    const lblW = ctx.measureText(heroLabel).width;
    ctx.fillText(`   (${pctStr})`, valueX + lblW, statY0);
    ctx.restore();
  }
  void pnlValueText;

  if (!overlay.compactStats) {
    ctx.font = `700 ${labelFontPx}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('INVESTED', padX, statY0 + rowH);
    ctx.font = `800 ${valueFontPx}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(
      args.investedUsd == null ? '\u2014' : formatCompactUsd(args.investedUsd),
      valueX,
      statY0 + rowH,
    );

    ctx.font = `700 ${labelFontPx}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('POSITION', padX, statY0 + rowH * 2);
    ctx.font = `800 ${valueFontPx}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(
      args.positionUsd == null ? '\u2014' : formatCompactUsd(args.positionUsd),
      valueX,
      statY0 + rowH * 2,
    );
  }

  /* --- Footer --- */
  const footerY = h - padY;
  ctx.font = `800 ${Math.round(12 * ts)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = palette.nameTone;
  drawGlobeMark(ctx, padX, footerY - Math.round(11 * ts), Math.round(15 * ts), palette.nameTone);
  ctx.fillText(
    `POINTER.TRADE/${rawHandle.toLowerCase()}`,
    padX + Math.round(22 * ts),
    footerY,
  );

  if (overlay.showBranding) {
    ctx.textAlign = 'right';
    ctx.font = `700 ${Math.round(28 * ts)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = palette.nameTone;
    ctx.fillText(handle, w - padX, footerY);
    ctx.textAlign = 'left';
  }
  void logoBird;
}

function drawGlobeMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  stroke: string,
) {
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = Math.max(1, size * 0.11);
  const r = size / 2;
  ctx.beginPath();
  ctx.arc(x + r, y + r, r * 0.95, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + r - r * 0.95, y + r);
  ctx.lineTo(x + r + r * 0.95, y + r);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x + r, y + r, r * 0.4, r * 0.95, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
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

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rw: number,
  rh: number,
  r: number,
) {
  const rr = Math.min(r, rw / 2, rh / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + rw, y, x + rw, y + rh, rr);
  ctx.arcTo(x + rw, y + rh, x, y + rh, rr);
  ctx.arcTo(x, y + rh, x, y, rr);
  ctx.arcTo(x, y, x + rw, y, rr);
  ctx.closePath();
}

