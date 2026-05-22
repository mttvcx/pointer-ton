'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { PRESET_BACKGROUNDS } from '@/lib/share/backgrounds';
import type { ShareBackgroundPresetId } from '@/lib/share/types';
import { useOverlayPresence, OVERLAY_ANIM_CLOSE_MS } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
import { Z_APP_MODAL_OVERLAY } from '@/lib/ui/zLayers';
import { cn } from '@/lib/utils/cn';
import {
  clampPnlTrackerSize,
  DEFAULT_PNL_TRACKER_SIZE,
  PNL_TRACKER_SIZE_LIMITS,
  usePnlTrackerStore,
} from '@/store/pnlTracker';
import { PnlBackgroundImageEditor } from '@/components/pnl/PnlBackgroundImageEditor';

function SettingsToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border-subtle py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-fg-primary">{title}</p>
        <p className="mt-1 text-[10px] leading-snug text-fg-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent-primary' : 'bg-fg-muted/25',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 block h-5 w-5 rounded-full bg-fg-inverse shadow transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

export function PnlTrackerSettingsModal() {
  const open = usePnlTrackerStore((s) => s.settingsOpen);
  const setOpen = usePnlTrackerStore((s) => s.setSettingsOpen);
  const prefs = usePnlTrackerStore((s) => s.prefs);
  const size = usePnlTrackerStore((s) => s.size ?? DEFAULT_PNL_TRACKER_SIZE);
  const setSize = usePnlTrackerStore((s) => s.setSize);
  const setPrefs = usePnlTrackerStore((s) => s.setPrefs);
  const resetPrefs = usePnlTrackerStore((s) => s.resetPrefs);
  const customUrl = usePnlTrackerStore((s) => s.customBackgroundObjectUrl);
  const hydrateCustomBackground = usePnlTrackerStore((s) => s.hydrateCustomBackground);
  const setCustomBackgroundFromFile = usePnlTrackerStore((s) => s.setCustomBackgroundFromFile);
  const clearCustomBackground = usePnlTrackerStore((s) => s.clearCustomBackground);

  const { mounted, visible } = useOverlayPresence(open, OVERLAY_ANIM_CLOSE_MS);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (!open) return;
    void hydrateCustomBackground();
  }, [open, hydrateCustomBackground]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!mounted || !portalRoot) return null;

  return createPortal(
    <div className={cn('fixed inset-0 flex items-center justify-center', Z_APP_MODAL_OVERLAY)}>
      <button
        type="button"
        aria-label="Close settings"
        className={cn('absolute inset-0 cursor-default bg-black/60', overlayBackdropClasses(visible))}
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pnl-settings-title"
        className={cn(
          'relative z-10 mx-3 flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-sm border border-border-subtle bg-bg-raised shadow-2xl',
          overlayPanelClasses(visible),
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-3">
          <h2 id="pnl-settings-title" className="text-sm font-semibold text-fg-primary">
            PNL Settings
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-sm px-2 py-1 text-[11px] font-semibold text-fg-muted hover:bg-bg-hover hover:text-fg-primary"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <section>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">General</p>
            <div className="rounded-sm border border-border-subtle px-3">
              <SettingsToggleRow
                title="Swap USD and SOL"
                description="Balance in USD and PNL in SOL. Off = balance in SOL and PNL in USD."
                checked={prefs.swapUsdAndSol}
                onChange={(swapUsdAndSol) => setPrefs({ swapUsdAndSol })}
              />
              <SettingsToggleRow
                title="Show alternate currency"
                description="Small secondary line under PNL with the other currency."
                checked={prefs.showAltCurrency}
                onChange={(showAltCurrency) => setPrefs({ showAltCurrency })}
              />
            </div>
          </section>

          <section>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">Widget size</p>
            <p className="mb-3 text-[11px] leading-snug text-fg-muted">
              Drag the widget edges or corner, or use the sliders below. You can also drag it above the top bar.
            </p>

            <label className="block">
              <span className="mb-1 flex justify-between text-[11px] text-fg-secondary">
                <span>Width</span>
                <span className="tabular-nums text-fg-muted">{size.width}px</span>
              </span>
              <input
                type="range"
                min={PNL_TRACKER_SIZE_LIMITS.minW}
                max={PNL_TRACKER_SIZE_LIMITS.maxW}
                step={4}
                value={size.width}
                onChange={(e) => {
                  const width = Number(e.target.value);
                  setSize(clampPnlTrackerSize(width, size.height));
                }}
                className="w-full accent-accent-primary"
              />
            </label>

            <label className="mt-3 block">
              <span className="mb-1 flex justify-between text-[11px] text-fg-secondary">
                <span>Height</span>
                <span className="tabular-nums text-fg-muted">{size.height}px</span>
              </span>
              <input
                type="range"
                min={PNL_TRACKER_SIZE_LIMITS.minH}
                max={PNL_TRACKER_SIZE_LIMITS.maxH}
                step={4}
                value={size.height}
                onChange={(e) => {
                  const height = Number(e.target.value);
                  setSize(clampPnlTrackerSize(size.width, height));
                }}
                className="w-full accent-accent-primary"
              />
            </label>

            <button
              type="button"
              onClick={() => setSize({ ...DEFAULT_PNL_TRACKER_SIZE })}
              className="mt-3 inline-flex items-center gap-1.5 rounded-sm px-1 py-0.5 text-[10px] font-semibold text-fg-muted hover:bg-bg-hover hover:text-fg-primary"
            >
              <RotateCcw className="h-3 w-3" strokeWidth={2} />
              Reset size
            </button>
          </section>

          <section>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">Appearance</p>

            <button
              type="button"
              onClick={() => {
                void clearCustomBackground();
                setPrefs({ backgroundId: PRESET_BACKGROUNDS[0]!.id as ShareBackgroundPresetId });
              }}
              className="mb-3 inline-flex items-center gap-1.5 rounded-sm px-1 py-0.5 text-[10px] font-semibold text-fg-muted hover:bg-bg-hover hover:text-fg-primary"
            >
              <RotateCcw className="h-3 w-3" strokeWidth={2} />
              Reset background
            </button>

            <PnlBackgroundImageEditor
              presetId={prefs.backgroundId}
              customUrl={customUrl}
              transform={prefs.backgroundTransform}
              onTransformChange={(backgroundTransform) => setPrefs({ backgroundTransform })}
              onPickFile={async (file) => {
                try {
                  await setCustomBackgroundFromFile(file);
                  toast.success('Custom background saved');
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Upload failed');
                }
              }}
              onClearCustom={async () => {
                await clearCustomBackground();
                toast.message('Custom background removed');
              }}
            />

            <div className="mt-3 flex flex-wrap gap-1.5">
              {PRESET_BACKGROUNDS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    void clearCustomBackground();
                    setPrefs({ backgroundId: p.id as ShareBackgroundPresetId });
                  }}
                  className={cn(
                    'rounded-sm border px-2 py-1 text-[10px] font-semibold transition',
                    prefs.backgroundId === p.id && !customUrl
                      ? 'border-accent-primary/40 bg-accent-primary/12 text-accent-primary'
                      : 'border-white/[0.08] text-fg-muted hover:text-fg-primary',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <label className="mt-4 block">
              <span className="mb-1 flex justify-between text-[11px] text-fg-secondary">
                <span>Blur</span>
                <span className="tabular-nums text-fg-muted">{prefs.blurPx}px</span>
              </span>
              <input
                type="range"
                min={0}
                max={20}
                value={prefs.blurPx}
                onChange={(e) => setPrefs({ blurPx: Number(e.target.value) })}
                className="w-full accent-accent-primary"
              />
            </label>

            <label className="mt-3 block">
              <span className="mb-1 flex justify-between text-[11px] text-fg-secondary">
                <span>Opacity</span>
                <span className="tabular-nums text-fg-muted">{prefs.opacityPct}%</span>
              </span>
              <input
                type="range"
                min={40}
                max={100}
                value={prefs.opacityPct}
                onChange={(e) => setPrefs({ opacityPct: Number(e.target.value) })}
                className="w-full accent-accent-primary"
              />
            </label>
          </section>
        </div>

        <footer className="flex shrink-0 items-center justify-between border-t border-border-subtle px-4 py-3">
          <button
            type="button"
            onClick={() => resetPrefs()}
            className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-[11px] font-semibold text-fg-muted hover:bg-bg-hover hover:text-fg-primary"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
            Reset
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-sm bg-accent-primary px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-fg-inverse hover:bg-accent-glow"
          >
            Done
          </button>
        </footer>
      </div>
    </div>,
    portalRoot,
  );
}
