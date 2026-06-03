'use client';

import type { CSSProperties } from 'react';

/** Shared landing motion — hero flank cards use the subtle drift keyframes too. */
export const LANDING_MOTION_KEYFRAMES = `
@keyframes pointerFrameDriftA {
  0%, 100% { transform: rotate(var(--frame-rot)) translate3d(0, 0, 0); }
  50%      { transform: rotate(var(--frame-rot)) translate3d(6px, -4px, 0); }
}
@keyframes pointerFrameDriftB {
  0%, 100% { transform: rotate(var(--frame-rot)) translate3d(0, 0, 0); }
  50%      { transform: rotate(var(--frame-rot)) translate3d(-5px, 5px, 0); }
}
@keyframes pointerTextureShift {
  0%, 100% { background-position: 0% 40%; }
  50%      { background-position: 100% 60%; }
}
@keyframes pointerEdgeLight {
  0%, 100% { opacity: 0.55; }
  50%      { opacity: 0.75; }
}
@keyframes pointerFloatLG {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50%      { transform: translate3d(8px, -10px, 0); }
}
@keyframes pointerFloatMD {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50%      { transform: translate3d(-6px, 8px, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .pointer-ambient-frame,
  .pointer-ambient-texture,
  .pointer-ambient-edge,
  [style*="pointerFloat"] {
    animation: none !important;
  }
}
`;

type FrameSpec = {
  w: string;
  h: string;
  rot: number;
  op: number;
  anim: 'pointerFrameDriftA' | 'pointerFrameDriftB';
  dur: number;
  delay: number;
};

const FRAMES: FrameSpec[] = [
  { w: 'min(78vw, 980px)', h: 'min(52vh, 520px)', rot: -5.5, op: 0.14, anim: 'pointerFrameDriftA', dur: 48, delay: 0 },
  { w: 'min(64vw, 820px)', h: 'min(44vh, 440px)', rot: 4, op: 0.11, anim: 'pointerFrameDriftB', dur: 54, delay: -14 },
  { w: 'min(52vw, 680px)', h: 'min(36vh, 360px)', rot: -2.5, op: 0.16, anim: 'pointerFrameDriftA', dur: 42, delay: -7 },
];

/** Geometric wire frames + linear blue wash — sharp, not soft blobs. */
export function LandingAmbientBackdrop() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LANDING_MOTION_KEYFRAMES }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-20 overflow-hidden bg-bg-base">
        {/* Slow diagonal texture — linear bands, no radial blur */}
        <div
          className="pointer-ambient-texture absolute inset-[-20%]"
          style={{
            backgroundImage:
              'linear-gradient(112deg, transparent 38%, rgb(var(--accent-primary-rgb) / 0.035) 49%, rgb(88 101 242 / 0.05) 51%, transparent 62%)',
            backgroundSize: '220% 220%',
            animation: 'pointerTextureShift 52s ease-in-out infinite',
          }}
        />

        {/* Right-edge panel light — flat gradient, Axiom dashboard sheen */}
        <div
          className="pointer-ambient-edge absolute inset-y-0 right-0 w-[min(48vw,560px)]"
          style={{
            background:
              'linear-gradient(270deg, rgb(88 101 242 / 0.07) 0%, rgb(var(--accent-primary-rgb) / 0.025) 35%, transparent 100%)',
            animation: 'pointerEdgeLight 36s ease-in-out infinite',
          }}
        />

        {/* Top cool wash — flat, no glow radius */}
        <div
          className="absolute inset-x-0 top-0 h-[min(55vh,520px)]"
          style={{
            background:
              'linear-gradient(180deg, rgb(var(--accent-primary-rgb) / 0.06) 0%, transparent 100%)',
          }}
        />

        <div className="absolute left-1/2 top-[38%] h-0 w-0">
          {FRAMES.map((f, i) => (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ width: f.w, height: f.h }}
            >
              <div
                className="pointer-ambient-frame h-full w-full rounded-xl border will-change-transform"
                style={
                  {
                    opacity: f.op,
                    '--frame-rot': `${f.rot}deg`,
                    borderColor: 'rgb(var(--accent-primary-rgb) / 0.12)',
                    background:
                      'linear-gradient(145deg, rgb(var(--accent-primary-rgb) / 0.015) 0%, transparent 50%)',
                    boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.015)',
                    animationName: f.anim,
                    animationDuration: `${f.dur}s`,
                    animationDelay: `${f.delay}s`,
                    animationTimingFunction: 'ease-in-out',
                    animationIterationCount: 'infinite',
                  } as CSSProperties
                }
              />
            </div>
          ))}
        </div>

        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgb(var(--bg-base-rgb)/0.4)_55%,rgb(var(--bg-base-rgb)/0.92)_100%)]" />
      </div>
    </>
  );
}
