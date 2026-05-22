'use client';

import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Search, X } from 'lucide-react';
import { PrefToggle } from '@/components/preferences/controls';
import { AUTO_TRANSLATE_LANGUAGES } from '@/lib/translate/autoTranslateLanguages';
import { useOverlayPresence, OVERLAY_ANIM_CLOSE_MS } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
import { Z_APP_MODAL_OVERLAY } from '@/lib/ui/zLayers';
import {
  DEFAULT_AUTO_TRANSLATE_SETTINGS,
  useAutoTranslateStore,
  type AutoTranslateSettings,
} from '@/store/autoTranslate';
import { cn } from '@/lib/utils/cn';

interface AutoTranslateModalProps {
  open: boolean;
  onClose: () => void;
}

export function AutoTranslateModal({ open, onClose }: AutoTranslateModalProps) {
  const store = useAutoTranslateStore();
  const { mounted, visible } = useOverlayPresence(open, OVERLAY_ANIM_CLOSE_MS);
  const [draft, setDraft] = useState<AutoTranslateSettings>(() => ({
    enabled: store.enabled,
    showOnHover: store.showOnHover,
    showBoth: store.showBoth,
    textColor: store.textColor,
    translateAllLanguages: store.translateAllLanguages,
    selectedLanguageIds: [...store.selectedLanguageIds],
  }));
  const [langQuery, setLangQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    setDraft({
      enabled: store.enabled,
      showOnHover: store.showOnHover,
      showBoth: store.showBoth,
      textColor: store.textColor,
      translateAllLanguages: store.translateAllLanguages,
      selectedLanguageIds: [...store.selectedLanguageIds],
    });
    setLangQuery('');
  }, [
    open,
    store.enabled,
    store.showOnHover,
    store.showBoth,
    store.textColor,
    store.translateAllLanguages,
    store.selectedLanguageIds,
  ]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const selectedSet = useMemo(() => new Set(draft.selectedLanguageIds), [draft.selectedLanguageIds]);

  const filteredLanguages = useMemo(() => {
    const q = langQuery.trim().toLowerCase();
    if (!q) return AUTO_TRANSLATE_LANGUAGES;
    return AUTO_TRANSLATE_LANGUAGES.filter(
      (l) =>
        l.region.toLowerCase().includes(q) ||
        l.native.toLowerCase().includes(q) ||
        l.english.toLowerCase().includes(q),
    );
  }, [langQuery]);

  const allFilteredSelected =
    filteredLanguages.length > 0 && filteredLanguages.every((l) => selectedSet.has(l.id));

  function patchDraft(patch: Partial<AutoTranslateSettings>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function toggleLanguage(id: (typeof AUTO_TRANSLATE_LANGUAGES)[number]['id']) {
    setDraft((d) => {
      const next = new Set(d.selectedLanguageIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...d, selectedLanguageIds: [...next] };
    });
  }

  function selectAllFiltered() {
    setDraft((d) => {
      const next = new Set(d.selectedLanguageIds);
      for (const l of filteredLanguages) next.add(l.id);
      return { ...d, selectedLanguageIds: [...next] };
    });
  }

  function clearAllFiltered() {
    setDraft((d) => {
      const remove = new Set(filteredLanguages.map((l) => l.id));
      return {
        ...d,
        selectedLanguageIds: d.selectedLanguageIds.filter((id) => !remove.has(id)),
      };
    });
  }

  function handleContinue() {
    store.setSettings(draft);
    onClose();
  }

  if (!mounted) return null;

  return (
    <div className={cn('fixed inset-0 flex items-center justify-center p-4', Z_APP_MODAL_OVERLAY)}>
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="auto-translate-title"
        className={cn(
          'relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-[420px] flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-raised shadow-2xl',
          overlayPanelClasses(visible),
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-3">
          <h2 id="auto-translate-title" className="text-[15px] font-semibold text-fg-primary">
            Auto Translate
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-5">
            <PrefToggle
              label="Auto Translate"
              description="Token tickers and names will automatically be translated to English"
              value={draft.enabled}
              onChange={(v) => patchDraft({ enabled: v })}
            />
            <PrefToggle
              label="Show translation on hover"
              description="Translations will appear on hover instead of replacing the original text"
              value={draft.showOnHover}
              onChange={(v) => patchDraft({ showOnHover: v })}
            />
            <PrefToggle
              label="Show both original and translated text"
              description="Translated and original text will be displayed together. Available on Pulse and Token pages"
              value={draft.showBoth}
              onChange={(v) => patchDraft({ showBoth: v })}
            />

            <div>
              <div className="mb-2 text-xs font-medium text-fg-primary">Translation text color</div>
              <div className="flex items-center gap-2">
                <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border-subtle">
                  <input
                    type="color"
                    value={draft.textColor}
                    onChange={(e) => patchDraft({ textColor: e.target.value })}
                    className="absolute inset-0 h-[140%] w-[140%] -translate-x-1/4 -translate-y-1/4 cursor-pointer border-0 p-0"
                    aria-label="Translation text color"
                  />
                </label>
                <input
                  type="text"
                  value={draft.textColor}
                  onChange={(e) => patchDraft({ textColor: e.target.value })}
                  className="h-9 min-w-0 flex-1 rounded-md border border-border-subtle bg-bg-sunken px-2.5 font-mono text-[12px] text-fg-primary outline-none focus:border-border-default focus:ring-1 focus:ring-accent-primary/30"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => patchDraft({ textColor: DEFAULT_AUTO_TRANSLATE_SETTINGS.textColor })}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-subtle text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
                  aria-label="Reset color"
                >
                  <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                </button>
              </div>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 text-xs font-medium text-fg-primary">Translate all languages</div>
              <button
                type="button"
                role="switch"
                aria-checked={draft.translateAllLanguages}
                onClick={() => patchDraft({ translateAllLanguages: !draft.translateAllLanguages })}
                className={cn(
                  'mt-0.5 inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors',
                  draft.translateAllLanguages ? 'bg-accent-primary' : 'bg-bg-sunken',
                )}
              >
                <span
                  className={cn(
                    'inline-block h-3 w-3 rounded-full bg-fg-primary transition-transform',
                    draft.translateAllLanguages ? 'translate-x-3.5' : 'translate-x-0.5',
                  )}
                />
              </button>
            </div>

            <div
              className={cn(
                'rounded-lg border border-border-subtle bg-bg-sunken/60',
                draft.translateAllLanguages && 'pointer-events-none opacity-45',
              )}
            >
              <div className="flex items-center gap-2 border-b border-border-subtle px-2.5 py-2">
                <div className="relative min-w-0 flex-1">
                  <Search
                    className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <input
                    value={langQuery}
                    onChange={(e) => setLangQuery(e.target.value)}
                    placeholder="Search languages to translate…"
                    className="h-8 w-full rounded-md border border-border-subtle bg-bg-raised pl-7 pr-2 text-[11px] text-fg-primary outline-none placeholder:text-fg-muted focus:border-border-default"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => (allFilteredSelected ? clearAllFiltered() : selectAllFiltered())}
                  className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-accent-primary transition-colors hover:bg-bg-hover"
                >
                  {allFilteredSelected ? 'Clear' : 'Select All'}
                </button>
              </div>

              <ul className="max-h-[220px] overflow-y-auto [scrollbar-width:thin]">
                {filteredLanguages.map((lang) => {
                  const checked = selectedSet.has(lang.id);
                  return (
                    <li key={lang.id}>
                      <label className="flex cursor-pointer items-center gap-2 border-b border-border-subtle/50 px-3 py-2.5 last:border-b-0 hover:bg-bg-hover/50">
                        <span className="w-7 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                          {lang.region}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] text-fg-primary">{lang.native}</span>
                          <span className="block truncate text-[11px] text-fg-muted">{lang.english}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleLanguage(lang.id)}
                          className="h-4 w-4 shrink-0 rounded border-border-default bg-bg-sunken text-accent-primary focus:ring-accent-primary/40"
                        />
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>

        <footer className="shrink-0 border-t border-border-subtle p-4">
          <button
            type="button"
            onClick={handleContinue}
            className="btn-press focus-ring h-10 w-full rounded-full bg-accent-primary text-[13px] font-semibold text-fg-inverse transition hover:brightness-110"
          >
            Continue
          </button>
        </footer>
      </div>
    </div>
  );
}
