/**
 * Procedural pack celebration audio (Web Audio API).
 * Timings align with CSS keyframes in app/globals.css.
 */

import { JACKPOT_STING_MS } from '@/lib/packs/celebrations';

let audioCtx: AudioContext | null = null;

export async function resumePackAudio(): Promise<AudioContext | null> {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  try {
    if (audioCtx.state === 'suspended') await audioCtx.resume();
  } catch {
    /* autoplay gate */
  }
  return audioCtx;
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const n = Math.ceil(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function tone(
  ctx: AudioContext,
  when: number,
  freq: number,
  dur: number,
  vol: number,
  type: OscillatorType = 'sine',
): void {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, when);
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(vol, when + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0006, when + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(when);
  o.stop(when + dur + 0.03);
}

function noiseHit(
  ctx: AudioContext,
  when: number,
  dur: number,
  vol: number,
  opts?: { lowpass?: number; highpass?: number },
): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, dur);
  const g = ctx.createGain();
  const chain: AudioNode[] = [src];
  if (opts?.highpass) {
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = opts.highpass;
    chain.push(hp);
  }
  if (opts?.lowpass) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = opts.lowpass;
    chain.push(lp);
  }
  chain.push(g);
  for (let i = 0; i < chain.length - 1; i++) chain[i]!.connect(chain[i + 1]!);
  g.connect(ctx.destination);
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(vol, when + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0005, when + dur);
  src.start(when);
  src.stop(when + dur + 0.04);
}

function sweep(
  ctx: AudioContext,
  when: number,
  f0: number,
  f1: number,
  dur: number,
  vol: number,
  type: OscillatorType = 'sawtooth',
): void {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, when);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), when + dur);
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(vol, when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0006, when + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(when);
  o.stop(when + dur + 0.03);
}

function chord(
  ctx: AudioContext,
  when: number,
  freqs: number[],
  dur: number,
  vol: number,
): void {
  const v = vol / freqs.length;
  for (const f of freqs) tone(ctx, when, f, dur, v);
}

type StopFn = () => void;

function schedule(ms: number, fn: () => void): StopFn {
  const id = window.setTimeout(() => void fn(), ms);
  return () => clearTimeout(id);
}

function stopScheduledSources(nodes: AudioScheduledSourceNode[]): void {
  for (const n of nodes) {
    try {
      n.stop();
    } catch {
      /* already stopped */
    }
  }
  nodes.length = 0;
}

/**
 * Black void before helicopter — sustained “oh shit, jackpot” buildup (JACKPOT_STING_MS).
 * Not a single hit: sub drop → drone → riser → heartbeat → pre-heli swell.
 */
export function startPackJackpotStingSounds(): StopFn {
  const stops: StopFn[] = [];
  const sustained: AudioScheduledSourceNode[] = [];

  stops.push(
    schedule(0, () => {
      void resumePackAudio().then((ctx) => {
        if (!ctx) return;
        const t = ctx.currentTime;
        const dur = JACKPOT_STING_MS / 1000;
        const end = t + dur;

        noiseHit(ctx, t, 0.22, 0.28, { lowpass: 100 });
        tone(ctx, t + 0.04, 52, 0.35, 0.2, 'sine');
        tone(ctx, t + 0.1, 98, 0.18, 0.1, 'triangle');

        const drone = ctx.createOscillator();
        const droneG = ctx.createGain();
        drone.type = 'sine';
        drone.frequency.setValueAtTime(56, t);
        drone.frequency.exponentialRampToValueAtTime(78, t + dur * 0.85);
        droneG.gain.setValueAtTime(0, t);
        droneG.gain.linearRampToValueAtTime(0.11, t + 0.4);
        droneG.gain.linearRampToValueAtTime(0.17, t + dur * 0.72);
        droneG.gain.exponentialRampToValueAtTime(0.0008, end);
        drone.connect(droneG);
        droneG.connect(ctx.destination);
        drone.start(t);
        drone.stop(end + 0.05);
        sustained.push(drone);

        const sub = ctx.createOscillator();
        const subG = ctx.createGain();
        sub.type = 'triangle';
        sub.frequency.setValueAtTime(38, t + 0.15);
        sub.frequency.exponentialRampToValueAtTime(52, t + dur * 0.9);
        subG.gain.setValueAtTime(0, t);
        subG.gain.linearRampToValueAtTime(0.09, t + 0.55);
        subG.gain.linearRampToValueAtTime(0.13, t + dur * 0.75);
        subG.gain.exponentialRampToValueAtTime(0.0008, end);
        sub.connect(subG);
        subG.connect(ctx.destination);
        sub.start(t);
        sub.stop(end + 0.05);
        sustained.push(sub);

        const bed = ctx.createBufferSource();
        bed.buffer = noiseBuffer(ctx, dur + 0.2);
        bed.loop = true;
        const bedLp = ctx.createBiquadFilter();
        bedLp.type = 'lowpass';
        bedLp.frequency.setValueAtTime(140, t);
        bedLp.frequency.exponentialRampToValueAtTime(3200, t + dur * 0.88);
        bedLp.Q.setValueAtTime(1.2, t);
        const bedG = ctx.createGain();
        bed.connect(bedLp);
        bedLp.connect(bedG);
        bedG.connect(ctx.destination);
        bedG.gain.setValueAtTime(0, t);
        bedG.gain.linearRampToValueAtTime(0.045, t + 0.45);
        bedG.gain.linearRampToValueAtTime(0.11, t + dur * 0.8);
        bedG.gain.exponentialRampToValueAtTime(0.0008, end);
        bed.start(t);
        bed.stop(end + 0.05);
        sustained.push(bed);

        for (let i = 0; i < 5; i++) {
          const w = t + 0.38 + i * 0.4;
          const pulseVol = 0.1 + i * 0.025;
          tone(ctx, w, 44, 0.1, pulseVol, 'sine');
          noiseHit(ctx, w + 0.02, 0.07, pulseVol * 0.55, { lowpass: 110 });
        }

        sweep(ctx, t + 0.55, 95, 480, dur * 0.72, 0.075, 'sine');
        sweep(ctx, t + dur * 0.55, 280, 920, dur * 0.38, 0.065, 'triangle');

        chord(ctx, t + dur * 0.62, [196, 247, 294], 0.45, 0.08);
        chord(ctx, t + dur * 0.78, [262, 330, 392, 494], 0.5, 0.11);
        tone(ctx, t + dur * 0.82, 587, 0.35, 0.09, 'sine');

        noiseHit(ctx, t + dur * 0.88, 0.4, 0.22, { lowpass: 700 });
        sweep(ctx, t + dur * 0.9, 520, 1400, 0.35, 0.1, 'sine');
        chord(ctx, t + dur * 0.92, [440, 554, 659, 880], 0.4, 0.12);
      });
    }),
  );

  return () => {
    stops.forEach((s) => s());
    stopScheduledSources(sustained);
  };
}

/** @deprecated Use `startPackJackpotStingSounds` for cleanup on stage change. */
export async function playPackJackpotSting(): Promise<void> {
  startPackJackpotStingSounds();
}

/** Mythic helicopter sequence — 12s timeline. */
export function startPackHelicopterSounds(): StopFn {
  const stops: StopFn[] = [];
  const D = 12_000;

  stops.push(
    schedule(0, () => {
      void resumePackAudio().then((ctx) => {
        if (!ctx) return;
        const t = ctx.currentTime;
        sweep(ctx, t, 480, 95, 2.6, 0.07, 'sine');
        noiseHit(ctx, t + 0.04, 2.6, 0.12, { lowpass: 260 });
        for (let i = 0; i < 40; i++) {
          const w = t + 0.12 + i * 0.28;
          noiseHit(ctx, w, 0.12, 0.035 + (i % 3) * 0.01, { lowpass: 380 });
        }
      });
    }),
  );

  stops.push(
    schedule(0.14 * D, () => {
      void resumePackAudio().then((ctx) => {
        if (!ctx) return;
        const t = ctx.currentTime;
        sweep(ctx, t, 420, 180, 0.45, 0.2, 'sawtooth');
        noiseHit(ctx, t + 0.05, 0.5, 0.28, { lowpass: 600 });
      });
    }),
  );

  stops.push(
    schedule(0.2 * D, () => {
      void resumePackAudio().then((ctx) => {
        if (!ctx) return;
        const t = ctx.currentTime;
        sweep(ctx, t, 1200, 400, 0.35, 0.12, 'triangle');
        tone(ctx, t + 0.12, 880, 0.08, 0.1, 'square');
      });
    }),
  );

  for (const pct of [0.24, 0.28, 0.32, 0.36, 0.4, 0.44, 0.48]) {
    stops.push(
      schedule(pct * D, () => {
        void resumePackAudio().then((ctx) => {
          if (!ctx) return;
          const t = ctx.currentTime;
          tone(ctx, t, 180 + Math.random() * 40, 0.06, 0.14, 'square');
          noiseHit(ctx, t, 0.08, 0.1, { highpass: 800, lowpass: 2400 });
        });
      }),
    );
  }

  stops.push(
    schedule(0.58 * D, () => {
      void resumePackAudio().then((ctx) => {
        if (!ctx) return;
        const t = ctx.currentTime;
        noiseHit(ctx, t, 0.5, 0.45, { lowpass: 180 });
        tone(ctx, t + 0.05, 64, 0.4, 0.28, 'sine');
        chord(ctx, t + 0.15, [523, 659, 784, 988], 0.55, 0.2);
      });
    }),
  );

  stops.push(
    schedule(0.6 * D, () => {
      void resumePackAudio().then((ctx) => {
        if (!ctx) return;
        const t = ctx.currentTime;
        sweep(ctx, t, 200, 1200, 0.35, 0.1, 'sine');
      });
    }),
  );

  return () => stops.forEach((s) => s());
}

/** Legendary vault open — 8.5s timeline. */
export function startPackVaultSounds(): StopFn {
  const stops: StopFn[] = [];
  const D = 8_500;

  for (let i = 0; i < 6; i++) {
    stops.push(
      schedule(0.08 * D + i * 110, () => {
        void resumePackAudio().then((ctx) => {
          if (!ctx) return;
          tone(ctx, ctx.currentTime, 420 + i * 18, 0.04, 0.09, 'square');
        });
      }),
    );
  }

  stops.push(
    schedule(0.28 * D, () => {
      void resumePackAudio().then((ctx) => {
        if (!ctx) return;
        const t = ctx.currentTime;
        tone(ctx, t, 220, 0.12, 0.16, 'triangle');
        noiseHit(ctx, t + 0.02, 0.15, 0.12, { lowpass: 900 });
      });
    }),
  );

  stops.push(
    schedule(0.38 * D, () => {
      void resumePackAudio().then((ctx) => {
        if (!ctx) return;
        const t = ctx.currentTime;
        sweep(ctx, t, 80, 40, 0.5, 0.22, 'sawtooth');
        tone(ctx, t + 0.08, 1200, 0.06, 0.08, 'sine');
      });
    }),
  );

  stops.push(
    schedule(0.5 * D, () => {
      void resumePackAudio().then((ctx) => {
        if (!ctx) return;
        const t = ctx.currentTime;
        noiseHit(ctx, t, 0.6, 0.2, { lowpass: 400 });
        sweep(ctx, t, 60, 120, 0.7, 0.18, 'sine');
      });
    }),
  );

  stops.push(
    schedule(0.58 * D, () => {
      void resumePackAudio().then((ctx) => {
        if (!ctx) return;
        const t = ctx.currentTime;
        chord(ctx, t, [196, 247, 294], 1.2, 0.12);
        noiseHit(ctx, t, 1.5, 0.08, { lowpass: 300 });
      });
    }),
  );

  stops.push(
    schedule(0.68 * D, () => {
      void resumePackAudio().then((ctx) => {
        if (!ctx) return;
        const t = ctx.currentTime;
        chord(ctx, t, [523, 659, 784, 988, 1175], 0.7, 0.18);
        tone(ctx, t + 0.1, 1318, 0.35, 0.12, 'sine');
      });
    }),
  );

  stops.push(
    schedule(0.86 * D, () => {
      void resumePackAudio().then((ctx) => {
        if (!ctx) return;
        const t = ctx.currentTime;
        noiseHit(ctx, t, 0.25, 0.35, { lowpass: 500 });
        tone(ctx, t + 0.02, 880, 0.2, 0.15, 'sine');
      });
    }),
  );

  return () => stops.forEach((s) => s());
}

/** Epic candle surge — 6.8s timeline. */
export function startPackCandleSurgeSounds(): StopFn {
  const stops: StopFn[] = [];
  const D = 6_800;

  const glitchPcts = [0.08, 0.1, 0.12, 0.14, 0.16, 0.18, 0.2, 0.22, 0.24];
  for (const pct of glitchPcts) {
    stops.push(
      schedule(pct * D, () => {
        void resumePackAudio().then((ctx) => {
          if (!ctx) return;
          const t = ctx.currentTime;
          noiseHit(ctx, t, 0.04, 0.14, { highpass: 1200, lowpass: 6000 });
          tone(ctx, t, 800 + Math.random() * 400, 0.03, 0.06, 'square');
        });
      }),
    );
  }

  stops.push(
    schedule(0.28 * D, () => {
      void resumePackAudio().then((ctx) => {
        if (!ctx) return;
        const t = ctx.currentTime;
        sweep(ctx, t, 200, 900, 0.4, 0.16, 'sawtooth');
        noiseHit(ctx, t + 0.1, 0.35, 0.12, { lowpass: 800 });
      });
    }),
  );

  stops.push(
    schedule(0.32 * D, () => {
      void resumePackAudio().then((ctx) => {
        if (!ctx) return;
        const t = ctx.currentTime;
        sweep(ctx, t, 120, 520, 1.8, 0.14, 'sine');
        for (let i = 0; i < 8; i++) {
          tone(ctx, t + i * 0.18, 180 + i * 35, 0.08, 0.05, 'triangle');
        }
      });
    }),
  );

  stops.push(
    schedule(0.55 * D, () => {
      void resumePackAudio().then((ctx) => {
        if (!ctx) return;
        const t = ctx.currentTime;
        tone(ctx, t, 440, 0.08, 0.1, 'sine');
        sweep(ctx, t + 0.05, 300, 1200, 0.25, 0.12, 'triangle');
      });
    }),
  );

  stops.push(
    schedule(0.68 * D, () => {
      void resumePackAudio().then((ctx) => {
        if (!ctx) return;
        const t = ctx.currentTime;
        chord(ctx, t, [392, 494, 587, 740], 0.5, 0.16);
        tone(ctx, t + 0.08, 988, 0.25, 0.12, 'sine');
        noiseHit(ctx, t, 0.2, 0.1, { highpass: 2000 });
      });
    }),
  );

  stops.push(
    schedule(0.78 * D, () => {
      void resumePackAudio().then((ctx) => {
        if (!ctx) return;
        const t = ctx.currentTime;
        chord(ctx, t, [523, 659, 784, 988], 0.45, 0.14);
      });
    }),
  );

  return () => stops.forEach((s) => s());
}

/** Pack rip burst (optional — gold/legendary open). */
export async function playPackOpenBurst(): Promise<void> {
  const ctx = await resumePackAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  noiseHit(ctx, t, 0.2, 0.35, { lowpass: 1200 });
  sweep(ctx, t, 180, 80, 0.15, 0.2, 'sawtooth');
  tone(ctx, t + 0.05, 520, 0.12, 0.12, 'sine');
}
