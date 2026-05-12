'use client';

/**
 * Inline neon Pointer bird — drawn from the existing /branding/logo-bird.svg path
 * with an electric-edge glow built from layered SVG filters. No raster asset; safe
 * to render at any size for export.
 */
export function PointerNeonBird({
  className,
  glow = 'violet',
}: {
  className?: string;
  glow?: 'violet' | 'cyan' | 'mono';
}) {
  const inner = glow === 'cyan' ? '#0a0c14' : glow === 'mono' ? '#0a0c14' : '#0c0820';
  const rim =
    glow === 'cyan'
      ? '#5cf2ff'
      : glow === 'mono'
        ? '#cdd5e2'
        : '#8a6bff';
  const rim2 =
    glow === 'cyan' ? '#9efcff' : glow === 'mono' ? '#f4f6fa' : '#c2a8ff';
  const halo =
    glow === 'cyan' ? '#22d3ee' : glow === 'mono' ? '#94a3b8' : '#7c3aed';

  /* The shipped path is a flat arrow; we draw a stylised swallow silhouette here
   * (kept in code, not bitmap) so the export reproduces the reference vibe. */
  const wing =
    'M64 376 C 132 308 196 250 264 196 C 230 248 214 286 214 318 C 268 286 322 268 384 256 C 332 280 290 312 248 358 C 304 332 358 320 416 320 C 348 348 286 384 224 432 C 198 404 168 388 132 384 C 108 380 86 380 64 376 Z';

  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      role="img"
      aria-label="Pointer"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="pnb-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={inner} stopOpacity="0.96" />
          <stop offset="55%" stopColor={inner} stopOpacity="0.86" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.92" />
        </linearGradient>
        <linearGradient id="pnb-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={rim} stopOpacity="0.65" />
          <stop offset="55%" stopColor={rim2} stopOpacity="0.95" />
          <stop offset="100%" stopColor={rim} stopOpacity="0.6" />
        </linearGradient>
        <radialGradient id="pnb-halo" cx="62%" cy="50%" r="58%">
          <stop offset="0%" stopColor={halo} stopOpacity="0.42" />
          <stop offset="55%" stopColor={halo} stopOpacity="0.08" />
          <stop offset="100%" stopColor={halo} stopOpacity="0" />
        </radialGradient>
        <filter id="pnb-outer" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id="pnb-edge" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
      </defs>

      <rect width="512" height="512" fill="url(#pnb-halo)" opacity="0.85" />

      <g filter="url(#pnb-outer)" opacity="0.55">
        <path d={wing} fill={halo} />
      </g>

      <path d={wing} fill="url(#pnb-body)" />

      <g filter="url(#pnb-edge)" opacity="0.9">
        <path
          d={wing}
          fill="none"
          stroke="url(#pnb-rim)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      </g>
      <path
        d={wing}
        fill="none"
        stroke={rim2}
        strokeOpacity="0.55"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}
