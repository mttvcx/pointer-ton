import type { PackType } from '@/types/pack';

/** Tier-specific SVG artwork — trading motifs, not generic game numbers. */
export function PackFoilArtLayer({ type }: { type: PackType }) {
  switch (type) {
    case 'bronze':
      return <BronzeArt />;
    case 'silver':
      return <SilverArt />;
    case 'gold':
      return <GoldArt />;
    case 'legendary':
      return <LegendaryArt />;
    default:
      return null;
  }
}

function BronzeArt() {
  return (
    <svg
      className="pack-art-svg pack-art-svg--bronze"
      viewBox="0 0 200 280"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="bronzeFoil" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3d2a14" />
          <stop offset="45%" stopColor="#6b4423" />
          <stop offset="100%" stopColor="#1a1208" />
        </linearGradient>
        <linearGradient id="bronzeSheen" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(212,165,116,0.35)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
      </defs>
      <rect width="200" height="280" fill="url(#bronzeFoil)" />
      <rect width="200" height="120" fill="url(#bronzeSheen)" />
      {/* Wallet trace */}
      <path
        d="M 24 200 Q 48 175 72 188 T 120 165 T 168 142"
        fill="none"
        stroke="rgba(180, 130, 70, 0.35)"
        strokeWidth="1.2"
        strokeDasharray="3 4"
      />
      <circle cx="24" cy="200" r="3" fill="rgba(212, 165, 116, 0.5)" />
      <circle cx="72" cy="188" r="2" fill="rgba(212, 165, 116, 0.35)" />
      <circle cx="120" cy="165" r="2.5" fill="rgba(212, 165, 116, 0.4)" />
      {/* Micro chart */}
      <polyline
        points="20,230 35,218 52,224 68,205 88,210 108,192 128,198 148,178 168,185"
        fill="none"
        stroke="rgba(34, 197, 94, 0.45)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="20" y="248" width="42" height="8" rx="1" fill="rgba(255,255,255,0.04)" />
      <rect x="22" y="250" width="18" height="2" rx="0.5" fill="rgba(255,255,255,0.12)" />
      <rect x="22" y="253" width="28" height="1.5" rx="0.5" fill="rgba(255,255,255,0.06)" />
      <text x="155" y="48" fill="rgba(212,165,116,0.2)" fontSize="7" fontFamily="system-ui,sans-serif" fontWeight="600">
        MC $42K
      </text>
      {/* Market data ticks */}
      {[
        [155, 55],
        [170, 72],
        [145, 88],
      ].map((pt, i) => {
        const [x, y] = pt as [number, number];
        return (
        <g key={i} opacity={0.25}>
          <line x1={x} y1={y} x2={x + 12} y2={y} stroke="rgba(212,165,116,0.6)" strokeWidth="0.8" />
          <line x1={x} y1={y} x2={x} y2={y + 8} stroke="rgba(212,165,116,0.4)" strokeWidth="0.8" />
        </g>
        );
      })}
    </svg>
  );
}

function SilverArt() {
  return (
    <svg
      className="pack-art-svg pack-art-svg--silver"
      viewBox="0 0 200 280"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="silverFoil" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0c1220" />
          <stop offset="40%" stopColor="#1a2744" />
          <stop offset="100%" stopColor="#060a12" />
        </linearGradient>
        <radialGradient id="silverRadar" cx="50%" cy="38%" r="55%">
          <stop offset="0%" stopColor="rgba(56, 189, 248, 0.22)" />
          <stop offset="70%" stopColor="rgba(56, 189, 248, 0)" />
        </radialGradient>
      </defs>
      <rect width="200" height="280" fill="url(#silverFoil)" />
      <ellipse cx="100" cy="105" rx="90" ry="75" fill="url(#silverRadar)" />
      {/* Radar sweep */}
      <path
        d="M 100 105 L 100 30 A 75 75 0 0 1 175 105 Z"
        fill="rgba(56, 189, 248, 0.08)"
      />
      <circle cx="100" cy="105" r="68" fill="none" stroke="rgba(96, 165, 250, 0.2)" strokeWidth="0.8" />
      <circle cx="100" cy="105" r="42" fill="none" stroke="rgba(96, 165, 250, 0.15)" strokeWidth="0.6" />
      <circle cx="100" cy="105" r="18" fill="none" stroke="rgba(96, 165, 250, 0.25)" strokeWidth="0.8" />
      {/* Wallet clusters */}
      {[
        [62, 92],
        [118, 78],
        [134, 118],
        [78, 128],
        [108, 142],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="4" fill="rgba(56, 189, 248, 0.35)" />
          <circle cx={x} cy={y} r="8" fill="none" stroke="rgba(56, 189, 248, 0.15)" strokeWidth="0.6" />
        </g>
      ))}
      {/* Flow lines */}
      <path
        d="M 40 210 C 70 190, 90 220, 120 200 S 160 185, 175 205"
        fill="none"
        stroke="rgba(147, 197, 253, 0.35)"
        strokeWidth="1.2"
      />
      <path
        d="M 30 235 C 55 218, 85 240, 110 225"
        fill="none"
        stroke="rgba(56, 189, 248, 0.25)"
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      <rect x="28" y="52" width="56" height="22" rx="3" fill="rgba(15,30,55,0.5)" stroke="rgba(56,189,248,0.2)" strokeWidth="0.6" />
      <path d="M 34 68 L 42 60 L 52 64 L 64 54 L 76 58" fill="none" stroke="rgba(56,189,248,0.5)" strokeWidth="1" />
    </svg>
  );
}

function GoldArt() {
  return (
    <svg
      className="pack-art-svg pack-art-svg--gold"
      viewBox="0 0 200 280"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="goldFoil" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2a1f08" />
          <stop offset="35%" stopColor="#5c4512" />
          <stop offset="70%" stopColor="#3d2e0a" />
          <stop offset="100%" stopColor="#120e04" />
        </linearGradient>
        <linearGradient id="goldHolo" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(250, 204, 21, 0)" />
          <stop offset="35%" stopColor="rgba(253, 224, 71, 0.25)" />
          <stop offset="55%" stopColor="rgba(251, 191, 36, 0.15)" />
          <stop offset="100%" stopColor="rgba(250, 204, 21, 0)" />
        </linearGradient>
      </defs>
      <rect width="200" height="280" fill="url(#goldFoil)" />
      <rect x="-20" y="40" width="240" height="60" fill="url(#goldHolo)" transform="rotate(-8 100 70)" />
      {/* Whale entry arrow */}
      <path
        d="M 28 195 L 95 155 L 95 168 L 155 128"
        fill="none"
        stroke="rgba(251, 191, 36, 0.55)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon points="155,128 142,132 148,118" fill="rgba(253, 224, 71, 0.7)" />
      <circle cx="28" cy="195" r="5" fill="rgba(251, 191, 36, 0.4)" />
      <circle cx="155" cy="128" r="7" fill="rgba(253, 224, 71, 0.25)" stroke="rgba(253,224,71,0.6)" strokeWidth="1" />
      {/* Momentum bars */}
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={162 + i * 6}
          y={200 - i * 14}
          width="4"
          height={24 + i * 10}
          rx="1"
          fill={`rgba(251, 191, 36, ${0.15 + i * 0.12})`}
        />
      ))}
      <path
        d="M 20 240 L 45 225 L 70 232 L 100 210 L 130 218 L 165 195"
        fill="none"
        stroke="rgba(34, 197, 94, 0.5)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <ellipse cx="100" cy="72" rx="55" ry="28" fill="none" stroke="rgba(253,224,71,0.12)" strokeWidth="0.8" />
    </svg>
  );
}

function LegendaryArt() {
  return (
    <svg
      className="pack-art-svg pack-art-svg--legendary"
      viewBox="0 0 200 280"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="legFoil" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0a0614" />
          <stop offset="40%" stopColor="#1a0f2e" />
          <stop offset="100%" stopColor="#030208" />
        </linearGradient>
        <linearGradient id="legHolo" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(167, 139, 250, 0.3)" />
          <stop offset="50%" stopColor="rgba(192, 132, 252, 0.12)" />
          <stop offset="100%" stopColor="rgba(88, 28, 135, 0.25)" />
        </linearGradient>
        <radialGradient id="legGlow" cx="50%" cy="35%" r="50%">
          <stop offset="0%" stopColor="rgba(192, 132, 252, 0.35)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>
      <rect width="200" height="280" fill="url(#legFoil)" />
      <rect width="200" height="280" fill="url(#legHolo)" opacity="0.85" />
      <ellipse cx="100" cy="95" rx="85" ry="70" fill="url(#legGlow)" />
      {/* Syndicate network */}
      <path
        d="M 50 120 L 100 80 L 150 115 M 100 80 L 100 150 M 50 120 L 75 165 M 150 115 L 125 170"
        fill="none"
        stroke="rgba(167, 139, 250, 0.35)"
        strokeWidth="1"
      />
      {[
        [50, 120],
        [100, 80],
        [150, 115],
        [75, 165],
        [125, 170],
        [100, 150],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="5" fill="rgba(192, 132, 252, 0.45)" />
      ))}
      {/* Premium accent lines */}
      <path
        d="M 16 250 Q 100 220 184 250"
        fill="none"
        stroke="rgba(251, 191, 36, 0.25)"
        strokeWidth="0.8"
      />
      <path
        d="M 24 55 L 176 55"
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="0.5"
      />
      <rect x="118" y="200" width="62" height="28" rx="4" fill="rgba(30,10,50,0.55)" stroke="rgba(192,132,252,0.25)" strokeWidth="0.7" />
      <path d="M 126 218 L 138 208 L 152 214 L 168 202" fill="none" stroke="rgba(167,139,250,0.55)" strokeWidth="1.2" />
    </svg>
  );
}
