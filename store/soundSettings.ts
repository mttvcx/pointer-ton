'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Global notification-sound preferences.
 *
 * Sounds ride on the existing procedural synths (chime / bell / pop from
 * lib/alerts/alertRulePayloadAudio) plus user-uploaded custom clips (≤3s,
 * stored as data URLs so they persist offline and cross to mobile parity via
 * the same shape). Per-event toggles let a user silence one channel without
 * killing the rest.
 */

export type SoundEventId = 'toast' | 'squad_message' | 'launch_alert' | 'alpha_mention';

/** A sound reference — a built-in preset id, or `custom:<uuid>`. */
export type SoundRef = string;

export type CustomSound = {
  id: string;
  name: string;
  /** data: URL of the audio, ≤ MAX_CUSTOM_BYTES. */
  dataUrl: string;
  durationMs: number;
};

export type SoundEventConfig = {
  enabled: boolean;
  sound: SoundRef;
};

/** Hard caps — keep localStorage sane and enforce the ≤3s rule. */
export const MAX_CUSTOM_SOUND_MS = 3000;
export const MAX_CUSTOM_BYTES = 400_000; // ~300KB source file after base64
export const MAX_CUSTOM_SOUNDS = 6;

export const SOUND_EVENTS: { id: SoundEventId; label: string; hint: string }[] = [
  { id: 'toast', label: 'App notifications', hint: 'Toasts across the terminal' },
  { id: 'squad_message', label: 'Squad messages', hint: 'New message in a squad room' },
  { id: 'launch_alert', label: 'Launch alerts', hint: 'A launch matched your rules (wallet / X / launchpad)' },
  { id: 'alpha_mention', label: 'Alpha mentions', hint: 'Alpha / mention alerts' },
];

function defaultEvents(): Record<SoundEventId, SoundEventConfig> {
  return {
    toast: { enabled: false, sound: 'pop' },
    squad_message: { enabled: true, sound: 'chime' },
    launch_alert: { enabled: true, sound: 'bell' },
    alpha_mention: { enabled: true, sound: 'chime' },
  };
}

type SoundSettingsState = {
  masterEnabled: boolean;
  volume: number; // 0..1
  events: Record<SoundEventId, SoundEventConfig>;
  customSounds: CustomSound[];
  setMasterEnabled: (v: boolean) => void;
  setVolume: (v: number) => void;
  setEventEnabled: (id: SoundEventId, enabled: boolean) => void;
  setEventSound: (id: SoundEventId, sound: SoundRef) => void;
  addCustomSound: (s: CustomSound) => void;
  removeCustomSound: (id: string) => void;
};

export const useSoundSettings = create<SoundSettingsState>()(
  persist(
    (set, get) => ({
      masterEnabled: true,
      volume: 0.85,
      events: defaultEvents(),
      customSounds: [],
      setMasterEnabled: (masterEnabled) => set({ masterEnabled }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      setEventEnabled: (id, enabled) =>
        set((s) => ({ events: { ...s.events, [id]: { ...s.events[id], enabled } } })),
      setEventSound: (id, sound) =>
        set((s) => ({ events: { ...s.events, [id]: { ...s.events[id], sound } } })),
      addCustomSound: (snd) =>
        set((s) => ({ customSounds: [...s.customSounds, snd].slice(-MAX_CUSTOM_SOUNDS) })),
      removeCustomSound: (id) => {
        const removed = get().customSounds.find((c) => c.id === id);
        set((s) => {
          // Any event pointing at the removed custom sound falls back to chime.
          const events = { ...s.events };
          if (removed) {
            for (const key of Object.keys(events) as SoundEventId[]) {
              if (events[key].sound === `custom:${id}`) {
                events[key] = { ...events[key], sound: 'chime' };
              }
            }
          }
          return { customSounds: s.customSounds.filter((c) => c.id !== id), events };
        });
      },
    }),
    {
      name: 'pointer-sound-settings',
      partialize: (s) => ({
        masterEnabled: s.masterEnabled,
        volume: s.volume,
        events: s.events,
        customSounds: s.customSounds,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SoundSettingsState>;
        return {
          ...current,
          ...p,
          // Ensure every event key exists even if the persisted blob predates one.
          events: { ...defaultEvents(), ...(p.events ?? {}) },
          customSounds: Array.isArray(p.customSounds) ? p.customSounds : [],
        };
      },
    },
  ),
);
