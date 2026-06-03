'use client';

import { cn } from '@/lib/utils/cn';

/** Side-view rescue helicopter — illustrated SVG with rotor disc. */
export function HelicopterRescueSvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('pack-helicopter-svg block w-full', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="phBody" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#6b7280" />
          <stop offset="40%" stopColor="#374151" />
          <stop offset="100%" stopColor="#111827" />
        </linearGradient>
        <linearGradient id="phGlass" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0c4a6e" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="phStripe" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fcd34d" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <radialGradient id="phRotorDisc" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
          <stop offset="70%" stopColor="rgba(255,255,255,0.22)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
        </radialGradient>
        <filter id="phShadow" x="-15%" y="-15%" width="130%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#000" floodOpacity="0.65" />
        </filter>
      </defs>

      {/* Main rotor disc */}
      <ellipse cx="138" cy="34" rx="132" ry="14" fill="url(#phRotorDisc)" className="pack-helicopter-main-rotor" />

      <g filter="url(#phShadow)">
        {/* Tail */}
        <path d="M278 82h132c8 0 14 6 14 14v10c0 8-6 14-14 14H278l-16-16v-6l16-16z" fill="url(#phBody)" />
        <path d="M396 94h34l10 8-10 8h-34v-16z" fill="#1f2937" />
        <g className="pack-helicopter-tail-rotor">
          <ellipse cx="430" cy="102" rx="4" ry="20" fill="rgba(255,255,255,0.4)" />
        </g>

        {/* Fuselage */}
        <path
          d="M52 92c0-26 22-46 48-46h128c32 0 54 22 54 50v8c0 10-8 18-18 18H68c-12 0-18-10-18-18v-12z"
          fill="url(#phBody)"
        />
        <path d="M100 58h96v12H100z" fill="url(#phStripe)" />
        <path d="M78 56c10-14 28-22 48-22s38 10 46 24l-10 28H84l-6-30z" fill="url(#phGlass)" />
        <path d="M118 44h28v8c-8 2-16 2-24 0v-8h-4z" fill="rgba(255,255,255,0.3)" />

        {/* Skids */}
        <path d="M86 128h168c5 0 10 5 10 10H76c0-5 5-10 10-10z" fill="#0f1419" stroke="#4b5563" strokeWidth="2.5" />
        <path d="M98 128v12M148 128v12M198 128v12M248 128v12" stroke="#4b5563" strokeWidth="3.5" strokeLinecap="round" />

        {/* Winch */}
        <rect x="188" y="102" width="28" height="18" rx="3" fill="#1f2937" stroke="#4b5563" strokeWidth="1" />
        <circle cx="202" cy="111" r="5" fill="#0a0a0a" stroke="#6b7280" strokeWidth="1.5" />
        {/* Winch anchor point */}
        <circle cx="202" cy="120" r="3" fill="#fbbf24" />
      </g>

      {/* Mast */}
      <rect x="132" y="36" width="10" height="28" rx="3" fill="#4b5563" />
    </svg>
  );
}
