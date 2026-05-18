'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { X, GripVertical, RefreshCw } from 'lucide-react';
import type { DockTrackerId } from '@/lib/dock/dockTrackerConfig';
import { DOCK_TRACKER_IDS, dockTrackerLabel } from '@/lib/dock/dockTrackerConfig';
import { DOCK_TRACKER_ICON } from '@/components/layout/dockTrackerUi';
import {
  normalizeDockModes,
  normalizeDockOrder,
  useDockTrackersStore,
} from '@/store/dockTrackers';
import { cn } from '@/lib/utils/cn';

/** Preview sample inside the Full / Compact / Icon tiles (appearance is global — not tied to any one tracker name). */
const DOCK_PREVIEW_ID: DockTrackerId = 'pulse';

function captureKeyLabel(e: KeyboardEvent): string | null {
  if (e.repeat) return null;
  if (e.key === 'Escape') return null;
  if (['Control', 'Alt', 'Meta', 'Shift'].includes(e.key)) return null;
  e.preventDefault();
  if (e.key === 'Backspace' || e.key === 'Delete') return '__clear__';
  if (e.key === ' ') return 'Space';
  if (e.key.length === 1) return e.key.toUpperCase();
  return e.key;
}

/** Only mounted while open — local UI state resets each time the modal opens. */
function DockTrackersSettingsModalContent() {
  const onClose = () => useDockTrackersStore.getState().setSettingsOpen(false);

  const orderRaw = useDockTrackersStore((s) => s.order);
  const order = useMemo(() => normalizeDockOrder(orderRaw), [orderRaw]);
  const modesRaw = useDockTrackersStore((s) => s.modes);
  const modes = useMemo(() => normalizeDockModes(modesRaw), [modesRaw]);
  const badges = useDockTrackersStore((s) => s.badges);
  const hotkeysEnabled = useDockTrackersStore((s) => s.hotkeysEnabled);
  const hotkeys = useDockTrackersStore((s) => s.hotkeys);

  const setOrder = useDockTrackersStore((s) => s.setOrder);
  const moveItem = useDockTrackersStore((s) => s.moveItem);
  const setAllModes = useDockTrackersStore((s) => s.setAllModes);
  const setBadge = useDockTrackersStore((s) => s.setBadge);
  const setHotkeysEnabled = useDockTrackersStore((s) => s.setHotkeysEnabled);
  const setHotkey = useDockTrackersStore((s) => s.setHotkey);
  const resetDock = useDockTrackersStore((s) => s.resetDock);
  const spotTickerMode = useDockTrackersStore((s) => s.spotTickerMode);
  const setSpotTickerMode = useDockTrackersStore((s) => s.setSpotTickerMode);

  const [listening, setListening] = useState<DockTrackerId | null>(null);
  const listeningRef = useRef<DockTrackerId | null>(null);
  const [dragIx, setDragIx] = useState<number | null>(null);

  useLayoutEffect(() => {
    listeningRef.current = listening;
  }, [listening]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (listeningRef.current) {
        setListening(null);
        e.preventDefault();
        return;
      }
      useDockTrackersStore.getState().setSettingsOpen(false);
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);

  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      const lbl = captureKeyLabel(e);
      if (lbl === null) {
        setListening(null);
        return;
      }
      if (lbl === '__clear__') {
        setHotkey(listening, null);
        setListening(null);
        return;
      }
      setHotkey(listening, lbl);
      setListening(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listening, setHotkey]);

  const unifiedAppearanceMode = useMemo(() => {
    const first = DOCK_TRACKER_IDS[0]!;
    const baseline = modes[first];
    return DOCK_TRACKER_IDS.every((id) => modes[id] === baseline) ? baseline : null;
  }, [modes]);

  const PreviewIcon = DOCK_TRACKER_ICON[DOCK_PREVIEW_ID];

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/55 p-3 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label="Trackers settings"
        className="relative flex max-h-[min(580px,calc(100vh-40px))] w-full max-w-[min(880px,calc(100vw-28px))] flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-raised shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5 sm:px-5">
          <h2 className="text-[14px] font-semibold text-fg-primary">Trackers Settings</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-1.5 text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2.5 sm:px-5">
          <p className="mb-2 text-[11px] font-medium leading-snug text-fg-primary/92">
            Drag to reorder dock items · tap the pink dot for the badge ping. Full · Compact · Icon applies to{' '}
            <span className="font-semibold text-fg-primary">every</span> tracker in the dock (Wallet through Squads).
          </p>

          <div className="flex flex-wrap items-start justify-center gap-1.5 rounded-lg border border-border-subtle bg-bg-sunken/40 p-1.5">
            {order.map((id, ix) => {
              const Icon = DOCK_TRACKER_ICON[id];
              const on = badges[id];
              return (
                <div
                  key={id}
                  draggable
                  onDragStart={() => setDragIx(ix)}
                  onDragOver={(ev) => ev.preventDefault()}
                  onDrop={() => {
                    if (dragIx === null || dragIx === ix) return;
                    moveItem(dragIx, ix);
                    setDragIx(null);
                  }}
                  onDragEnd={() => setDragIx(null)}
                  className="relative flex cursor-grab active:cursor-grabbing flex-col items-center gap-0.5 rounded-md border border-transparent px-2 py-1.5 transition-colors select-none hover:bg-bg-hover/90 active:brightness-110"
                >
                  <button
                    type="button"
                    title="Badge"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setBadge(id, !on);
                    }}
                    className={cn(
                      'absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-bg-raised',
                      on ? 'bg-pink-500' : 'bg-fg-muted/30',
                    )}
                  />
                  <GripVertical className="absolute bottom-1 left-0.5 h-2.5 w-2.5 text-fg-muted/60" aria-hidden />
                  <Icon className="h-[18px] w-[18px] text-fg-primary" strokeWidth={2} />
                  <span className="max-w-[4rem] truncate text-center text-[10px] font-medium leading-tight text-fg-primary/92">
                    {dockTrackerLabel(id, 'compact')}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mb-2 mt-3 space-y-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-secondary">Dock appearance</p>
            <p className="text-[11px] leading-snug text-fg-primary/92">
              One layout for all dock chips · preview uses{' '}
              <span className="font-semibold text-fg-primary">{dockTrackerLabel(DOCK_PREVIEW_ID, 'compact')}</span>.
              {!unifiedAppearanceMode ? (
                <>
                  {' '}
                  <span className="text-fg-secondary">Mixed sizes detected — tap a layout to unify.</span>
                </>
              ) : null}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {(['full', 'compact', 'icon'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setAllModes(m)}
                className={cn(
                  'rounded-lg border px-1.5 pb-2 pt-2 transition-colors',
                  unifiedAppearanceMode === m ? 'border-accent-primary bg-accent-primary/[0.06]' : 'border-border-subtle hover:bg-bg-hover/80',
                )}
              >
                <div className="mx-auto mb-1.5 flex h-[3rem] w-full flex-col items-center justify-center gap-1 rounded-md border border-white/[0.04] bg-bg-base px-1">
                  <PreviewIcon className="h-[18px] w-[18px] shrink-0 text-fg-primary" strokeWidth={2} />
                  {m === 'full' ? (
                    <span className="line-clamp-2 w-full text-center text-[7px] font-bold leading-tight text-fg-primary">
                      {dockTrackerLabel(DOCK_PREVIEW_ID, 'full')}
                    </span>
                  ) : m === 'compact' ? (
                    <span className="text-[9px] font-bold text-fg-primary">{dockTrackerLabel(DOCK_PREVIEW_ID, 'compact')}</span>
                  ) : null}
                </div>
                <span
                  className={cn(
                    'block text-center text-[10px] font-semibold capitalize',
                    unifiedAppearanceMode === m ? 'text-fg-primary' : 'text-fg-secondary',
                  )}
                >
                  {m}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-2.5">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-fg-primary">Major spot strip (BTC · ETH · native)</p>
              <p className="text-[10px] text-fg-secondary">Icons = colored badges only · Full = rotating price line</p>
            </div>
            <div className="flex gap-1 rounded-lg border border-border-subtle bg-bg-sunken/45 p-0.5">
              {(['full', 'icons'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSpotTickerMode(m)}
                  className={cn(
                    'rounded-md px-2 py-1 text-[10px] font-semibold capitalize transition-colors',
                    spotTickerMode === m ? 'bg-accent-primary/[0.2] text-fg-primary' : 'text-fg-muted hover:text-fg-primary',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-2.5">
            <span className="text-[12px] font-semibold text-fg-primary">Hotkeys</span>
            <button
              type="button"
              role="switch"
              aria-checked={hotkeysEnabled}
              onClick={() => setHotkeysEnabled(!hotkeysEnabled)}
              className={cn(
                'relative h-[22px] w-10 rounded-full border transition-colors',
                hotkeysEnabled
                  ? 'border-accent-primary bg-accent-primary/20'
                  : 'border-border-subtle bg-bg-sunken',
              )}
            >
              <span
                className={cn(
                  'absolute top-[3px] block h-[0.925rem] w-[0.925rem] rounded-full bg-fg-inverse shadow-sm transition-[left]',
                  hotkeysEnabled ? 'left-[1.125rem]' : 'left-[3px]',
                )}
              />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:gap-2">
            {order.map((id) => {
              const Icon = DOCK_TRACKER_ICON[id];
              const hk = hotkeys[id];
              const showListen = listening === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!hotkeysEnabled}
                  onClick={() => hotkeysEnabled && setListening(showListen ? null : id)}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors',
                    hotkeysEnabled
                      ? showListen
                        ? 'border-accent-primary bg-accent-primary/10'
                        : 'border-border-subtle hover:bg-bg-hover/90'
                      : 'cursor-not-allowed opacity-55',
                  )}
                >
                  <Icon className="h-[16px] w-[16px] shrink-0 text-fg-primary" strokeWidth={2} />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-fg-primary">
                    {dockTrackerLabel(id, 'compact')}
                  </span>
                  <span
                    className={cn(
                      'flex min-h-[24px] min-w-[34px] items-center justify-center rounded border px-1.5 text-[11px] font-bold tabular-nums',
                      showListen ? 'border-accent-primary bg-bg-base text-accent-primary' : 'border-border-subtle bg-bg-base text-fg-primary',
                    )}
                  >
                    {showListen ? '…' : hk ?? '\u2014'}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] leading-snug text-fg-secondary">
            Click a shortcut box, press a key, <strong className="text-fg-primary">Delete</strong> clears. Pulse opens a draggable
            popup (tabs New / Stretch / Migrated); hidden while you&apos;re already on{' '}
            <strong className="text-fg-primary">/pulse</strong>.
          </p>
        </div>

        <footer className="flex items-center gap-2 border-t border-border-subtle bg-bg-hover/35 px-3 py-2.5 sm:px-5">
          <button
            type="button"
            title="Reset"
            onClick={() => resetDock()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-bg-sunken text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
          >
            <RefreshCw className="h-[15px] w-[15px]" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => {
              setOrder(normalizeDockOrder(useDockTrackersStore.getState().order));
              onClose();
            }}
            className="btn-press h-8 flex-1 rounded-full bg-accent-primary text-[12px] font-semibold text-fg-inverse hover:brightness-110"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}

export function DockTrackersSettingsModal() {
  const open = useDockTrackersStore((s) => s.settingsOpen);
  if (!open) return null;
  return <DockTrackersSettingsModalContent />;
}
