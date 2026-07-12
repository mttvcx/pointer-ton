'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { CloseButton } from '@/components/ui/CloseButton';
import { ThemePicker } from '@/components/theme/ThemePicker';
import { CustomThemeImport } from '@/components/theme/CustomThemeImport';
import { DisplayPreferences } from '@/components/preferences/DisplayPreferences';
import { AutoSellSettings } from '@/components/settings/AutoSellSettings';
import { WatchlistSettingsSection } from '@/components/settings/WatchlistSettingsSection';
import { SoundSettingsSection } from '@/components/settings/SoundSettingsSection';
import { useOverlayPresence, OVERLAY_ANIM_CLOSE_MS } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
import { Z_APP_MODAL_OVERLAY } from '@/lib/ui/zLayers';
import { cn } from '@/lib/utils/cn';
import { useUIStore } from '@/store/ui';

type SettingsTab = 'general' | 'watchlist' | 'sounds';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'sounds', label: 'Sounds' },
  { id: 'watchlist', label: 'Watchlist' },
];

/**
 * Centered settings overlay. Opens on top of the current page, URL does not
 * change, theme picker live-previews so the user sees swatches apply behind
 * the dialog.
 */
export function SettingsModal() {
  const open = useUIStore((s) => s.settingsOpen);
  const initialTab = useUIStore((s) => s.settingsTab);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const dialogRef = useRef<HTMLDivElement>(null);
  const { mounted, visible } = useOverlayPresence(open, OVERLAY_ANIM_CLOSE_MS);
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  const onClose = () => setSettingsOpen(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const visibleTabs = useMemo(() => {
    if (!q) return TABS;
    return TABS.filter((t) => t.label.toLowerCase().includes(q));
  }, [q]);

  if (!mounted) return null;

  return (
    <div className={cn('fixed inset-0 flex items-center justify-center', Z_APP_MODAL_OVERLAY)}>
      <button
        type="button"
        aria-label="Close"
        className={cn(
          'absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm',
          overlayBackdropClasses(visible),
        )}
        onClick={onClose}
      />

      <div
        data-modal-panel
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        className={cn(
          'relative z-10 mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-raised shadow-2xl',
          overlayPanelClasses(visible),
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 border-b border-border-subtle bg-bg-raised px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="settings-modal-title"
                className="text-sm font-semibold tracking-tight text-fg-primary"
              >
                Settings
              </h2>
              <p className="mt-0.5 text-xs text-fg-muted">Manage your Pointer preferences.</p>
            </div>
            <CloseButton onClick={onClose} label="Close" size="md" />
          </div>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search settings"
              className="h-8 w-full rounded-md border border-border-subtle bg-bg-base pl-8 pr-3 text-[12px] text-fg-primary outline-none placeholder:text-fg-muted focus:border-accent-primary/45"
            />
          </div>

          <div className="mt-2 flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors duration-200',
                  tab === t.id
                    ? 'bg-accent-primary/15 text-accent-primary'
                    : 'text-fg-muted hover:bg-white/[0.05] hover:text-fg-secondary',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {tab === 'watchlist' ? (
            <WatchlistSettingsSection />
          ) : tab === 'sounds' ? (
            <SoundSettingsSection />
          ) : (
            <div className="space-y-6">
              <section>
                <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
                  Appearance
                </h3>
                <ThemePicker />
              </section>

              <section>
                <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
                  Display
                </h3>
                <DisplayPreferences />
              </section>

              <section>
                <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
                  Auto-Sell
                </h3>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3">
                  <AutoSellSettings />
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
                  Custom theme
                </h3>
                <p className="mb-3 text-xs leading-relaxed text-fg-muted">
                  Paste a JSON theme to apply your own palette. Use hex values (#0a0a0b) or RGB
                  triplets (&quot;10 10 11&quot;).
                </p>
                <CustomThemeImport />
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
