'use client';

import { cn } from '@/lib/utils/cn';

/** Side-profile Black Hawk–style rescue heli — detailed illustrated SVG. */
export function HelicopterBlackhawkSvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 920 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('pack-helicopter-model block w-full select-none', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="hbkBodyTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7a8494" />
          <stop offset="45%" stopColor="#4b5563" />
          <stop offset="100%" stopColor="#1f2937" />
        </linearGradient>
        <linearGradient id="hbkBodySide" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="50%" stopColor="#6b7280" />
          <stop offset="100%" stopColor="#374151" />
        </linearGradient>
        <linearGradient id="hbkGlass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#dbeafe" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#38bdf8" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#0c4a6e" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="hbkStripe" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <radialGradient id="hbkRotorBlur" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="55%" stopColor="rgba(255,255,255,0.28)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
        </radialGradient>
        <linearGradient id="hbkSearchlight" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <filter id="hbkDrop" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="16" stdDeviation="18" floodColor="#000" floodOpacity="0.75" />
        </filter>
      </defs>

      {/* Searchlight cone (rendered under heli in scene too) */}
      <path
        d="M248 168 L188 318 L308 318 Z"
        fill="url(#hbkSearchlight)"
        opacity="0.35"
        className="pack-helicopter-searchlight"
      />

      {/* Main rotor blur disc */}
      <ellipse
        cx="248"
        cy="42"
        rx="248"
        ry="22"
        fill="url(#hbkRotorBlur)"
        className="pack-helicopter-main-rotor"
      />
      <ellipse cx="248" cy="42" rx="248" ry="22" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />

      <g filter="url(#hbkDrop)">
        {/* Tail boom */}
        <path
          d="M520 132h300c12 0 22 10 22 22v16c0 12-10 22-22 22H520l-28-24v-12l28-24z"
          fill="url(#hbkBodySide)"
        />
        <path d="M812 148h52l14 12-14 12h-52v-24z" fill="#111827" />
        <rect x="798" y="138" width="8" height="36" rx="2" fill="#374151" />

        {/* Tail rotor */}
        <g className="pack-helicopter-tail-rotor">
          <ellipse cx="868" cy="156" rx="6" ry="34" fill="rgba(255,255,255,0.45)" />
          <ellipse cx="868" cy="156" rx="2" ry="34" fill="rgba(200,220,255,0.35)" />
        </g>

        {/* Fuselage */}
        <path
          d="M72 148c0-42 34-74 76-74h248c58 0 98 38 98 88v12c0 14-12 26-26 26H98c-18 0-26-14-26-26v-26z"
          fill="url(#hbkBodyTop)"
        />
        <path d="M120 92h300v18H120z" fill="url(#hbkStripe)" />
        <path
          d="M132 78c18-24 52-38 88-38s70 16 86 40l-18 48H148l-16-50z"
          fill="url(#hbkGlass)"
        />
        <path d="M168 62h52v14c-14 4-30 4-44 0V62h-8z" fill="rgba(255,255,255,0.35)" />

        {/* Panel lines */}
        <path d="M220 118h180M220 134h160M220 150h140" stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
        <path d="M380 108v56M420 108v56M460 108v56" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

        {/* Engine / exhaust */}
        <rect x="468" y="118" width="36" height="28" rx="4" fill="#111827" />
        <rect x="476" y="124" width="20" height="8" rx="2" fill="#374151" />

        {/* Skids */}
        <path
          d="M128 198h420c8 0 14 6 14 14H114c0-8 6-14 14-14z"
          fill="#0a0f14"
          stroke="#6b7280"
          strokeWidth="3"
        />
        <path d="M148 198v22M228 198v22M328 198v22M428 198v22M508 198v22" stroke="#6b7280" strokeWidth="4" strokeLinecap="round" />

        {/* Winch housing */}
        <rect x="318" y="162" width="44" height="28" rx="4" fill="#111827" stroke="#9ca3af" strokeWidth="1.5" />
        <circle cx="340" cy="176" r="9" fill="#0a0a0a" stroke="#d1d5db" strokeWidth="2" />
        <circle cx="340" cy="190" r="4.5" fill="#fbbf24" className="pack-helicopter-winch-pulse" />
      </g>

      {/* Rotor mast */}
      <rect x="240" y="44" width="16" height="38" rx="4" fill="#4b5563" />
      <circle cx="248" cy="44" r="8" fill="#374151" stroke="#9ca3af" strokeWidth="1" />
    </svg>
  );
}
