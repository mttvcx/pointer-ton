import type { ShareOverlaySettings } from '@/lib/share/types';

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

export function drawPnlCardFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  args: CardFrameArgs,
  overlay: ShareOverlaySettings,
): void {
  const pad = Math.round(w * 0.055);
  const alpha = overlay.overlayOpacity;
  ctx.fillStyle = `rgba(3,5,10,${alpha})`;
  ctx.fillRect(0, 0, w, h);

  const scale = overlay.textScale * (w / 1200);
  ctx.save();
  ctx.scale(scale, scale);

  const sx = overlay.overlayAlign === 'center' ? (w / scale - 520) / 2 : overlay.overlayAlign === 'right' ? w / scale - 520 - pad / scale : pad / scale;
  const sy = pad / scale;

  ctx.font = `700 ${Math.round(42 * scale)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(args.ticker.slice(0, 18).toUpperCase(), sx, sy + 42);

  if (overlay.showTokenName && args.tokenName) {
    ctx.font = `500 ${Math.round(18 * scale)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(226,232,240,0.72)';
    ctx.fillText(args.tokenName.slice(0, 36), sx, sy + 74);
  }

  const pos = args.pnlUsd != null && args.pnlUsd >= 0;
  const boxW = Math.min(420, w / scale - pad * 2);
  const boxH = 72;
  const boxY = sy + 96;
  ctx.fillStyle = pos ? args.accentHex : '#fb7185';
  roundRectPath(ctx, sx, boxY, boxW, boxH, 12);
  ctx.fill();

  const main =
    args.pnlUsd == null
      ? '—'
      : `${args.pnlUsd >= 0 ? '+' : '-'}$${formatCompact(Math.abs(args.pnlUsd))}`;
  ctx.font = `800 ${Math.round(36 * scale)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = '#05070c';
  ctx.fillText(main, sx + 18, boxY + 48);

  const pctStr =
    args.pnlPct == null
      ? '—'
      : `${args.pnlPct >= 0 ? '+' : ''}${args.pnlPct.toFixed(2)}%`;
  let pnlLine = '';
  if (overlay.pnlFormat === 'amount') pnlLine = `PNL ${main}`;
  else if (overlay.pnlFormat === 'pct') pnlLine = `PNL ${pctStr}`;
  else pnlLine = `PNL ${main} (${pctStr})`;

  let ly = boxY + boxH + 36;
  ctx.font = `600 ${Math.round(22 * scale)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = pos ? args.accentHex : '#fda4af';
  ctx.fillText(pnlLine, sx, ly);
  ly += 34;

  if (!overlay.compactStats) {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `500 ${Math.round(20 * scale)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(
      `Invested ${args.investedUsd == null ? '—' : `$${formatCompact(args.investedUsd)}`}`,
      sx,
      ly,
    );
    ly += 30;
    ctx.fillText(
      `Position ${args.positionUsd == null ? '—' : `$${formatCompact(args.positionUsd)}`}`,
      sx,
      ly,
    );
    ly += 44;
  }

  if (overlay.showWalletLabel || overlay.showWalletAddress) {
    ctx.font = `600 ${Math.round(20 * scale)}px ui-mono, monospace`;
    ctx.fillStyle = '#f1f5f9';
    const line =
      overlay.showWalletLabel && args.walletLabel
        ? args.walletLabel
        : overlay.showWalletAddress
          ? shortenAddr(args.walletAddress)
          : '';
    if (line) ctx.fillText(line, sx, ly);
    ly += 36;
  }

  if (overlay.showBranding) {
    ctx.font = `600 ${Math.round(16 * scale)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(226,232,240,0.55)';
    ctx.fillText('pointer.', sx, h / scale - pad / scale - 8);
  }

  if (overlay.showCashbackFooter) {
    ctx.font = `500 ${Math.round(14 * scale)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(148,163,184,0.9)';
    ctx.fillText('pointer.trade · 50% cashback. Forever.', sx, h / scale - pad / scale + 14);
  }

  ctx.restore();
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

function shortenAddr(a: string): string {
  if (a.length <= 12) return a;
  return `${a.slice(0, 4)}\u2026${a.slice(-4)}`;
}

function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(2);
}
