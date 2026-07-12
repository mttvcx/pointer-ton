'use client';

import {
  playAlertPresetSound,
  playAlertUrlSound,
  isSafeHttpsAudioUrl,
} from '@/lib/alerts/alertRulePayloadAudio';
import {
  useSoundSettings,
  MAX_CUSTOM_SOUND_MS,
  MAX_CUSTOM_BYTES,
  type SoundEventId,
  type SoundRef,
} from '@/store/soundSettings';

/** The three built-in presets — synthesized, no asset files needed. */
export const DEFAULT_SOUNDS: { id: string; label: string }[] = [
  { id: 'chime', label: 'Chime' },
  { id: 'bell', label: 'Bell' },
  { id: 'pop', label: 'Pop' },
];

const PRESET_IDS = new Set(DEFAULT_SOUNDS.map((s) => s.id));

/** Play a raw data:/https: audio clip at the given volume (best-effort). */
async function playClip(src: string, volume: number): Promise<void> {
  try {
    const a = new Audio(src);
    a.volume = Math.max(0, Math.min(1, volume));
    await a.play();
  } catch {
    /* autoplay gate or bad asset — no-op */
  }
}

/** Resolve a SoundRef against current settings and play it once. */
async function resolveAndPlay(sound: SoundRef, volume: number): Promise<void> {
  if (PRESET_IDS.has(sound)) {
    await playAlertPresetSound(sound);
    return;
  }
  if (sound.startsWith('custom:')) {
    const id = sound.slice('custom:'.length);
    const clip = useSoundSettings.getState().customSounds.find((c) => c.id === id);
    if (clip) await playClip(clip.dataUrl, volume);
    return;
  }
  if (isSafeHttpsAudioUrl(sound)) {
    await playAlertUrlSound(sound);
    return;
  }
  // Unknown ref — fall back to the default chime so a misconfig is still audible.
  await playAlertPresetSound('chime');
}

/**
 * Play the configured sound for an app event, honoring the master toggle and
 * per-event enable. Safe to call from anywhere on the client; no-ops on server.
 */
export async function playAppSound(eventId: SoundEventId): Promise<void> {
  if (typeof window === 'undefined') return;
  const s = useSoundSettings.getState();
  if (!s.masterEnabled) return;
  const cfg = s.events[eventId];
  if (!cfg || !cfg.enabled) return;
  await resolveAndPlay(cfg.sound, s.volume);
}

/** Preview a specific sound regardless of settings (for the settings UI). */
export async function previewSound(sound: SoundRef): Promise<void> {
  if (typeof window === 'undefined') return;
  await resolveAndPlay(sound, useSoundSettings.getState().volume);
}

export type LoadedCustomSound = { name: string; dataUrl: string; durationMs: number };

/** Measure an audio data URL's duration (ms) via a detached <audio> element. */
function measureDurationMs(dataUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const a = new Audio();
    const done = (ms: number) => {
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('error', onErr);
      resolve(ms);
    };
    const onMeta = () => {
      const d = a.duration;
      if (!Number.isFinite(d) || d <= 0) return done(0);
      done(Math.round(d * 1000));
    };
    const onErr = () => {
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('error', onErr);
      reject(new Error('Could not read that audio file.'));
    };
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('error', onErr);
    a.src = dataUrl;
  });
}

/**
 * Validate + load a user-uploaded sound file. Enforces audio type, size cap,
 * and the ≤3s duration rule. Returns the data URL + measured duration, or
 * throws with a user-facing message.
 */
export async function loadCustomSoundFile(file: File): Promise<LoadedCustomSound> {
  if (!file.type.startsWith('audio/')) {
    throw new Error('That’s not an audio file.');
  }
  if (file.size > MAX_CUSTOM_BYTES) {
    throw new Error(`Too large — keep it under ${Math.round(MAX_CUSTOM_BYTES / 1000)}KB.`);
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Could not read that file.'));
    r.readAsDataURL(file);
  });
  const durationMs = await measureDurationMs(dataUrl);
  if (durationMs > MAX_CUSTOM_SOUND_MS + 150 /* small tolerance */) {
    throw new Error(`Too long — max ${MAX_CUSTOM_SOUND_MS / 1000}s.`);
  }
  const name = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Custom sound';
  return { name, dataUrl, durationMs };
}
