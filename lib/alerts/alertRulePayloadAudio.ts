/**
 * Read alert-rule alert `audio` block from persisted payload (ingest / ticker).
 */
export type AlertRuleAudioPayload = {
  enabled?: boolean;
  preset?: string | null;
  url?: string | null;
};

export function readAudioFromAlertPayload(payload: unknown): AlertRuleAudioPayload | null {
  if (!payload || typeof payload !== 'object') return null;
  const audio = (payload as { audio?: unknown }).audio;
  if (!audio || typeof audio !== 'object') return null;
  const a = audio as Record<string, unknown>;
  return {
    enabled: typeof a.enabled === 'boolean' ? a.enabled : undefined,
    preset: typeof a.preset === 'string' ? a.preset : a.preset == null ? null : undefined,
    url: typeof a.url === 'string' ? a.url : a.url == null ? null : undefined,
  };
}

export function isSafeHttpsAudioUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

/**
 * Best-effort; respects autoplay policies (may no-op until user has interacted).
 */
export async function playAlertPresetSound(preset: string): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  } catch {
    /* ignore */
  }

  const now = ctx.currentTime;
  const p = (preset || 'chime').toLowerCase();

  const beep = (freq: number, start: number, dur: number, vol: number) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, start + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(start);
    o.stop(start + dur + 0.02);
  };

  if (p === 'bell') {
    beep(784, now, 0.12, 0.11);
    beep(988, now + 0.1, 0.12, 0.1);
    beep(1318, now + 0.2, 0.16, 0.09);
    return;
  }

  if (p === 'pop') {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, now);
    o.frequency.exponentialRampToValueAtTime(55, now + 0.06);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.08);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(now);
    o.stop(now + 0.1);
    return;
  }

  /* chime (default) */
  beep(880, now, 0.14, 0.12);
  beep(660, now + 0.12, 0.18, 0.1);
}

export async function playAlertUrlSound(url: string): Promise<void> {
  if (!isSafeHttpsAudioUrl(url)) return;
  try {
    const a = new Audio(url);
    a.volume = 0.85;
    await a.play();
  } catch {
    /* autoplay or bad asset */
  }
}

export async function playAlertRuleAudio(audio: AlertRuleAudioPayload): Promise<void> {
  if (audio.enabled === false) return;
  const url = audio.url?.trim();
  if (url && isSafeHttpsAudioUrl(url)) {
    await playAlertUrlSound(url);
    return;
  }
  await playAlertPresetSound(audio.preset ?? 'chime');
}
