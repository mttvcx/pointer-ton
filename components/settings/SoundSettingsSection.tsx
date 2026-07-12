'use client';

import { useRef, useState } from 'react';
import { Play, Plus, Trash2, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import {
  useSoundSettings,
  SOUND_EVENTS,
  MAX_CUSTOM_SOUNDS,
  MAX_CUSTOM_SOUND_MS,
  type SoundEventId,
} from '@/store/soundSettings';
import { DEFAULT_SOUNDS, loadCustomSoundFile, previewSound } from '@/lib/sound/appSounds';
import { cn } from '@/lib/utils/cn';

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors',
        on ? 'bg-accent-primary' : 'bg-white/10',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
          on ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

export function SoundSettingsSection() {
  const {
    masterEnabled,
    volume,
    events,
    customSounds,
    setMasterEnabled,
    setVolume,
    setEventEnabled,
    setEventSound,
    addCustomSound,
    removeCustomSound,
  } = useSoundSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const soundOptions = [
    ...DEFAULT_SOUNDS.map((s) => ({ value: s.id, label: s.label })),
    ...customSounds.map((c) => ({ value: `custom:${c.id}`, label: `★ ${c.name}` })),
  ];

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (customSounds.length >= MAX_CUSTOM_SOUNDS) {
      toast.error(`Max ${MAX_CUSTOM_SOUNDS} custom sounds — remove one first.`);
      return;
    }
    setBusy(true);
    try {
      const loaded = await loadCustomSoundFile(file);
      const id = crypto.randomUUID();
      addCustomSound({ id, ...loaded });
      toast.success(`Added “${loaded.name}”`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add that sound.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Master */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
        <div className="flex items-center gap-2">
          {masterEnabled ? (
            <Volume2 className="h-4 w-4 text-accent-primary" strokeWidth={2} aria-hidden />
          ) : (
            <VolumeX className="h-4 w-4 text-fg-muted" strokeWidth={2} aria-hidden />
          )}
          <div>
            <p className="text-[12px] font-semibold text-fg-primary">Notification sounds</p>
            <p className="text-[10px] text-fg-muted">Master switch for all sound effects</p>
          </div>
        </div>
        <Toggle on={masterEnabled} onChange={setMasterEnabled} label="Enable sounds" />
      </div>

      {/* Volume */}
      <div className={cn('px-1', !masterEnabled && 'pointer-events-none opacity-40')}>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-medium text-fg-secondary">Volume</span>
          <span className="text-[11px] tabular-nums text-fg-muted">{Math.round(volume * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-full accent-[rgb(var(--accent-primary-rgb))]"
        />
      </div>

      {/* Per-event */}
      <div className={cn('space-y-2', !masterEnabled && 'pointer-events-none opacity-40')}>
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-muted">Events</h4>
        {SOUND_EVENTS.map((ev) => {
          const cfg = events[ev.id as SoundEventId];
          return (
            <div
              key={ev.id}
              className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-fg-primary">{ev.label}</p>
                <p className="truncate text-[10px] text-fg-muted">{ev.hint}</p>
              </div>
              <select
                value={cfg.sound}
                onChange={(e) => setEventSound(ev.id, e.target.value)}
                disabled={!cfg.enabled}
                className="h-7 shrink-0 rounded-md border border-border-subtle bg-bg-base px-2 text-[11px] text-fg-primary outline-none focus:border-accent-primary/45 disabled:opacity-40"
              >
                {soundOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                title="Preview"
                aria-label={`Preview ${ev.label} sound`}
                onClick={() => void previewSound(cfg.sound)}
                className="btn-press flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-subtle text-fg-muted transition hover:text-fg-primary"
              >
                <Play className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </button>
              <Toggle
                on={cfg.enabled}
                onChange={(v) => setEventEnabled(ev.id, v)}
                label={`Enable ${ev.label}`}
              />
            </div>
          );
        })}
      </div>

      {/* Custom sounds */}
      <div className={cn('space-y-2', !masterEnabled && 'pointer-events-none opacity-40')}>
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
            Custom sounds
          </h4>
          <span className="text-[10px] text-fg-muted">
            {customSounds.length}/{MAX_CUSTOM_SOUNDS} · max {MAX_CUSTOM_SOUND_MS / 1000}s
          </span>
        </div>

        {customSounds.length > 0 ? (
          <ul className="space-y-1.5">
            {customSounds.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5"
              >
                <span className="min-w-0 flex-1 truncate text-[11px] text-fg-primary">{c.name}</span>
                <span className="shrink-0 text-[10px] tabular-nums text-fg-muted">
                  {(c.durationMs / 1000).toFixed(1)}s
                </span>
                <button
                  type="button"
                  title="Preview"
                  aria-label={`Preview ${c.name}`}
                  onClick={() => void previewSound(`custom:${c.id}`)}
                  className="btn-press flex h-6 w-6 shrink-0 items-center justify-center rounded text-fg-muted transition hover:text-fg-primary"
                >
                  <Play className="h-3 w-3" strokeWidth={2} aria-hidden />
                </button>
                <button
                  type="button"
                  title="Remove"
                  aria-label={`Remove ${c.name}`}
                  onClick={() => removeCustomSound(c.id)}
                  className="btn-press flex h-6 w-6 shrink-0 items-center justify-center rounded text-fg-muted transition hover:text-signal-bear"
                >
                  <Trash2 className="h-3 w-3" strokeWidth={2} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] leading-relaxed text-fg-muted">
            Upload your own clip (≤{MAX_CUSTOM_SOUND_MS / 1000}s) and pick it for any event above.
          </p>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={onPickFile}
        />
        <button
          type="button"
          disabled={busy || customSounds.length >= MAX_CUSTOM_SOUNDS}
          onClick={() => fileRef.current?.click()}
          className="btn-press inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-hover px-3 py-1.5 text-[11px] font-semibold text-fg-primary transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          {busy ? 'Adding…' : 'Upload custom sound'}
        </button>
      </div>
    </div>
  );
}
