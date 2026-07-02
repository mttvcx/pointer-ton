'use client';

import { useState, type KeyboardEvent } from 'react';
import { Plus, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import {
  useXMonitorSettings,
  type FeedSource,
  type LaunchRailSide,
  type LaunchRailStyle,
  type DeployMode,
} from '@/store/xMonitorSettings';

/** Preset accent options for the launch rail (last = "theme accent" / null). */
const COLOR_SWATCHES: Array<{ label: string; value: string | null }> = [
  { label: 'Theme', value: null },
  { label: 'Violet', value: '#7c5cff' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Red', value: '#ef4444' },
];

const SOURCES: Array<{ id: FeedSource; label: string; hint: string }> = [
  { id: 'x', label: 'X / Twitter', hint: '2,012 tracked accounts' },
  { id: 'instagram', label: 'Instagram', hint: 'Story + post events' },
  { id: 'truth', label: 'Truth Social', hint: 'Trump + affiliates' },
  { id: 'caTracker', label: 'CA Tracker', hint: 'Contract mentions' },
  { id: 'news', label: 'News', hint: '16 wires' },
  { id: 'affiliates', label: 'Affiliates', hint: '29 tagged sources' },
];

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-white/[0.06] px-3 py-3.5">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-fg-secondary">{title}</h3>
      {desc ? <p className="mt-0.5 text-[10.5px] leading-snug text-fg-muted">{desc}</p> : null}
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-white/[0.1] bg-white/[0.03] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'btn-press rounded px-3 py-1 text-[11px] font-semibold transition-colors',
            value === o.value
              ? 'bg-accent-primary/20 text-accent-primary'
              : 'text-fg-muted hover:text-fg-secondary',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors',
        on ? 'bg-accent-primary/80' : 'bg-white/[0.12]',
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

function TagInput({
  values,
  onChange,
  placeholder,
  prefix,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  prefix?: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim().replace(/^@/, '').toLowerCase();
    if (!v || values.includes(v)) {
      setDraft('');
      return;
    }
    onChange([...values, v]);
    setDraft('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add();
    } else if (e.key === 'Backspace' && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-white/[0.1] bg-white/[0.03] p-1.5">
      {values.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1 rounded bg-white/[0.07] px-1.5 py-0.5 text-[11px] text-fg-secondary"
        >
          {prefix}
          {v}
          <button
            type="button"
            onClick={() => onChange(values.filter((x) => x !== v))}
            className="text-fg-muted hover:text-signal-bear"
            aria-label={`Remove ${v}`}
          >
            <X className="h-3 w-3" strokeWidth={2.5} />
          </button>
        </span>
      ))}
      <div className="flex min-w-[90px] flex-1 items-center gap-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={add}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent px-1 py-0.5 text-[11px] text-fg-primary outline-none placeholder:text-fg-muted"
        />
        {draft.trim() ? (
          <button type="button" onClick={add} className="text-fg-muted hover:text-accent-primary" aria-label="Add">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function XMonitorSettings() {
  const s = useXMonitorSettings();

  return (
    <div className="flex-1 overflow-y-auto [scrollbar-color:rgba(255,255,255,0.14)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent">
      {/* Launch button */}
      <Section title="Launch button" desc="How the deploy rail looks on each feed card.">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-fg-secondary">Side</span>
            <Segmented<LaunchRailSide>
              value={s.launchRailSide}
              onChange={(v) => s.set({ launchRailSide: v })}
              options={[
                { value: 'left', label: 'Left' },
                { value: 'right', label: 'Right' },
              ]}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-fg-secondary">Style</span>
            <Segmented<LaunchRailStyle>
              value={s.launchRailStyle}
              onChange={(v) => s.set({ launchRailStyle: v })}
              options={[
                { value: 'fill', label: 'Fill' },
                { value: 'outline', label: 'Outline' },
              ]}
            />
          </div>
          <div>
            <span className="text-[11px] text-fg-secondary">Colour</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {COLOR_SWATCHES.map((c) => {
                const active = s.launchRailColor === c.value;
                return (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => s.set({ launchRailColor: c.value })}
                    title={c.label}
                    className={cn(
                      'h-6 w-6 rounded-md border transition-transform hover:scale-110',
                      active ? 'border-white ring-1 ring-white/60' : 'border-white/[0.12]',
                    )}
                    style={{
                      background: c.value ?? 'var(--accent-primary, #7c5cff)',
                    }}
                  >
                    {c.value === null ? <span className="text-[8px] font-bold text-white/90">A</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      {/* Deploy surface */}
      <Section title="Deploy" desc="Where the deploy form opens when you launch.">
        <Segmented<DeployMode>
          value={s.deployMode}
          onChange={(v) => s.set({ deployMode: v })}
          options={[
            { value: 'modal', label: 'Modal' },
            { value: 'sidePanel', label: 'Side panel' },
          ]}
        />
      </Section>

      {/* Feed sources */}
      <Section title="Feed accounts" desc="Toggle the channels that stream into the monitor.">
        <ul className="space-y-1.5">
          {SOURCES.map((src) => (
            <li
              key={src.id}
              className="flex items-center justify-between gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2"
            >
              <div className="min-w-0">
                <p className="text-[11.5px] font-medium text-fg-primary">{src.label}</p>
                <p className="text-[10px] text-fg-muted">{src.hint}</p>
              </div>
              <Toggle on={s.sources[src.id]} onChange={(v) => s.setSource(src.id, v)} />
            </li>
          ))}
        </ul>
      </Section>

      {/* Buy presets */}
      <Section title="Quick-buy presets" desc="SOL amounts shown on cards.">
        <div className="flex flex-wrap items-center gap-1.5">
          {s.buyPresets.map((amt, i) => (
            <span
              key={`${amt}-${i}`}
              className="inline-flex items-center gap-1 rounded bg-white/[0.07] px-2 py-1 text-[11px] font-semibold text-fg-secondary"
            >
              {amt} SOL
              <button
                type="button"
                onClick={() => s.set({ buyPresets: s.buyPresets.filter((_, j) => j !== i) })}
                className="text-fg-muted hover:text-signal-bear"
                aria-label={`Remove ${amt}`}
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            </span>
          ))}
          <PresetAdder
            onAdd={(n) => {
              if (!s.buyPresets.includes(n)) s.set({ buyPresets: [...s.buyPresets, n].sort((a, b) => a - b) });
            }}
          />
        </div>
      </Section>

      {/* Keyword highlights */}
      <Section title="Keyword highlights" desc="Cards containing these words glow accent.">
        <TagInput
          values={s.keywordHighlights}
          onChange={(v) => s.set({ keywordHighlights: v })}
          placeholder="add keyword…"
        />
      </Section>

      {/* Muted keywords */}
      <Section title="Muted keywords" desc="Hide cards that contain these words.">
        <TagInput
          values={s.mutedKeywords}
          onChange={(v) => s.set({ mutedKeywords: v })}
          placeholder="add mute…"
        />
      </Section>

      {/* Whitelist */}
      <Section title="Whitelist" desc="Only surface these handles (empty = all tracked).">
        <TagInput
          values={s.whitelistHandles}
          onChange={(v) => s.set({ whitelistHandles: v })}
          placeholder="add @handle…"
          prefix="@"
        />
      </Section>

      {/* AI suggestions */}
      <Section title="AI suggestions" desc="Name + ticker ideas generated per tweet.">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-fg-secondary">Enabled</span>
            <Toggle on={s.aiSuggestionsEnabled} onChange={(v) => s.set({ aiSuggestionsEnabled: v })} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-fg-secondary">Suggestions per tweet</span>
            <Stepper
              value={s.aiSuggestionCount}
              min={1}
              max={6}
              onChange={(n) => s.set({ aiSuggestionCount: n })}
            />
          </div>
        </div>
      </Section>

      {/* Keybinds */}
      <Section title="Keybinds" desc="Single-key shortcuts on the focused card.">
        <div className="space-y-2">
          {(
            [
              ['quickBuy', 'Quick buy'],
              ['deploy', 'Deploy'],
              ['dismiss', 'Dismiss'],
            ] as const
          ).map(([action, label]) => (
            <div key={action} className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-fg-secondary">{label}</span>
              <KeyCapture value={s.keybinds[action]} onChange={(k) => s.setKeybind(action, k)} />
            </div>
          ))}
        </div>
      </Section>

      {/* Reset */}
      <div className="px-3 py-3.5">
        <button
          type="button"
          onClick={() => s.reset()}
          className="btn-press inline-flex items-center gap-1.5 rounded-md border border-white/[0.1] px-2.5 py-1.5 text-[11px] font-semibold text-fg-muted transition-colors hover:border-signal-bear/40 hover:bg-signal-bear/[0.08] hover:text-signal-bear"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

function PresetAdder({ onAdd }: { onAdd: (n: number) => void }) {
  const [v, setV] = useState('');
  const commit = () => {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) onAdd(n);
    setV('');
  };
  return (
    <div className="inline-flex items-center gap-1 rounded border border-white/[0.1] bg-white/[0.03] px-1.5 py-0.5">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        inputMode="decimal"
        placeholder="+ SOL"
        className="w-14 bg-transparent text-[11px] text-fg-primary outline-none placeholder:text-fg-muted"
      />
    </div>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.03] px-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="btn-press px-1.5 py-0.5 text-[13px] font-bold text-fg-muted hover:text-fg-primary"
      >
        −
      </button>
      <span className="w-4 text-center text-[12px] font-semibold tabular-nums text-fg-primary">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="btn-press px-1.5 py-0.5 text-[13px] font-bold text-fg-muted hover:text-fg-primary"
      >
        +
      </button>
    </div>
  );
}

function KeyCapture({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  const [listening, setListening] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setListening(true)}
      onBlur={() => setListening(false)}
      onKeyDown={(e) => {
        if (!listening) return;
        if (e.key === 'Escape') {
          setListening(false);
          return;
        }
        if (e.key.length === 1) {
          e.preventDefault();
          onChange(e.key.toLowerCase());
          setListening(false);
        }
      }}
      className={cn(
        'min-w-[42px] rounded border px-2 py-1 text-center text-[11px] font-bold uppercase transition-colors',
        listening
          ? 'border-accent-primary bg-accent-primary/15 text-accent-primary'
          : 'border-white/[0.12] bg-white/[0.03] text-fg-secondary hover:border-white/25',
      )}
    >
      {listening ? '…' : value}
    </button>
  );
}
