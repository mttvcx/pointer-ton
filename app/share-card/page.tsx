import type { Metadata } from 'next';
import { ShotImage } from '@/components/share/ShotImage';

/**
 * Pointer social / referral share card — Axiom·Terminal tier.
 *
 * Standalone 1200×630 (OG / Twitter `summary_large_image` ratio) card that
 * composites the REAL product screenshot + the REAL brand mark. View it at
 * /share-card and export the .card element at 1200×630.
 *
 * ▶ To use your real screenshot: save a CLEAN, STRAIGHT (un-tilted) screenshot as
 *   public/share/terminal.png — the card picks it up automatically (placeholder
 *   until then) and applies the premium tilt / shadow / glow itself.
 */
export const metadata: Metadata = {
  title: 'Pointer — Share card',
  robots: { index: false, follow: false },
};

export default function ShareCardPage() {
  return (
    <div className="scw">
      {/* eslint-disable @next/next/no-img-element */}
      <style>{css}</style>

      <div className="card">
        {/* ── Ambient background ─────────────────────────────────────────── */}
        <div className="bg-base" />
        <div className="bg-glow" />
        <svg className="bg-contours" viewBox="0 0 1200 630" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <g fill="none" stroke="#ffffff" strokeOpacity="0.028" strokeWidth="1">
            <path d="M-40 470 C 240 360, 520 560, 820 430 S 1320 360, 1320 460" />
            <path d="M-40 520 C 260 410, 560 610, 860 480 S 1320 410, 1320 510" />
            <path d="M-40 570 C 280 470, 600 660, 900 540 S 1320 470, 1320 560" />
            <path d="M-40 620 C 300 540, 640 700, 940 600 S 1320 540, 1320 610" />
          </g>
        </svg>
        <img src="/branding/pointer-bird.png" alt="" className="bg-bird" />

        {/* ── Brand mark (top-left) ──────────────────────────────────────── */}
        <div className="brand">
          <img src="/branding/pointer-bird.png" alt="" className="brand-bird" />
          <span className="brand-word">pointer.</span>
        </div>

        {/* ── Headline + sub ─────────────────────────────────────────────── */}
        <div className="copy">
          <h1 className="headline">
            <span className="l1">
              WHERE THE <span className="accent">SHARPEST</span>
            </span>
            <span className="l2">
              <span className="accent">TRADERS</span> ARE
            </span>
          </h1>
          <p className="sub">Built for traders who move first.</p>
        </div>

        {/* ── Product screenshot (hero) ──────────────────────────────────── */}
        <div className="shot-wrap">
          <div className="shot-glow" />
          <ShotImage className="shot" />
        </div>
      </div>
    </div>
  );
}

const css = `
.scw {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #050706;
  overflow: auto;
}
.card {
  position: relative;
  width: 1200px;
  height: 630px;
  flex: none;
  overflow: hidden;
  font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
  background: #090b0a;
  isolation: isolate;
}
.bg-base {
  position: absolute; inset: 0;
  background:
    radial-gradient(120% 90% at 50% -10%, #0e1210 0%, #090b0a 55%),
    linear-gradient(180deg, #0a0d0c 0%, #070908 100%);
}
/* Faint green atmosphere, halo-ing the top edge of the screen. */
.bg-glow {
  position: absolute; inset: 0;
  background:
    radial-gradient(46% 36% at 50% 50%, rgba(61,220,151,0.14) 0%, rgba(61,220,151,0) 70%),
    radial-gradient(60% 44% at 50% 24%, rgba(61,220,151,0.05) 0%, rgba(61,220,151,0) 65%);
}
.bg-contours { position: absolute; inset: 0; width: 100%; height: 100%; }
/* Faint bird silhouette woven into the background. */
.bg-bird {
  position: absolute;
  right: -60px; top: -40px;
  width: 560px; height: auto;
  opacity: 0.05;
  filter: brightness(0) invert(1);
  transform: rotate(-6deg);
  pointer-events: none;
}

.brand {
  position: absolute; left: 56px; top: 44px;
  display: flex; align-items: center; gap: 10px;
  z-index: 3;
}
.brand-bird { width: 26px; height: auto; filter: brightness(0) invert(1); }
.brand-word { color: #fff; font-size: 21px; font-weight: 600; letter-spacing: -0.01em; }

.copy {
  position: absolute; left: 0; right: 0; top: 100px;
  z-index: 3; text-align: center; padding: 0 40px;
}
.headline {
  margin: 0;
  display: flex; flex-direction: column; gap: 2px;
  color: #fff;
  font-weight: 700;
  font-size: 72px;
  line-height: 0.98;
  letter-spacing: -0.035em;
}
.headline .l1, .headline .l2 { display: block; }
.headline .accent { color: #3ddc97; }
.sub {
  margin: 22px 0 0;
  color: rgba(255,255,255,0.52);
  font-size: 19px;
  font-weight: 450;
  letter-spacing: -0.005em;
}

/* Product screenshot — hero, starting below the copy and bleeding off the
   bottom (only its top ~half shows: nav + column heads, like the references). */
.shot-wrap {
  position: absolute;
  left: 50%; top: 318px;
  width: 1064px;
  transform: translateX(-50%) perspective(2600px) rotateX(4deg);
  transform-origin: 50% 0;
  z-index: 2;
}
.shot-glow {
  position: absolute; inset: -8% -5% 40% -5%;
  background: radial-gradient(60% 70% at 50% 0%, rgba(61,220,151,0.20) 0%, rgba(61,220,151,0) 70%);
  filter: blur(10px);
  z-index: -1;
}
.shot {
  width: 100%; height: auto; display: block;
  border-radius: 14px;
  /* slight cleanup — sharper, a touch more contrast */
  filter: contrast(1.05) saturate(1.03) brightness(1.02);
  /* premium shadow + rim light */
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.10),
    0 2px 0 rgba(255,255,255,0.04),
    0 40px 80px -30px rgba(0,0,0,0.85),
    0 24px 60px -40px rgba(61,220,151,0.35);
  outline: 1px solid rgba(255,255,255,0.07);
  outline-offset: 0;
}
`;
