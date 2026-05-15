'use client';

import { Check } from 'lucide-react';
import { THEMES } from '@/lib/theme/themes';
import { useTheme } from '@/components/theme/ThemeProvider';
import { cn } from '@/lib/utils/cn';

export function ThemePicker() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {THEMES.map((t) => {
        const active = theme === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setTheme(t.id)}
            aria-pressed={active}
            className={cn(
              'group relative rounded-lg p-3 text-left transition-colors',
              'bg-bg-raised hover:bg-bg-hover',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-primary/40',
              active
                ? 'ring-1 ring-inset ring-accent-primary'
                : 'ring-1 ring-inset ring-border-subtle',
            )}
          >
            <div className="mb-3 flex gap-1" aria-hidden>
              {t.swatches.map((color, i) => (
                <div
                  key={`${t.id}-${i}`}
                  className="h-8 flex-1 rounded"
                  style={{ background: color }}
                />
              ))}
            </div>

            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-fg-primary">{t.label}</p>
                <p className="mt-0.5 text-xs leading-snug text-fg-muted">{t.description}</p>
              </div>
              {active ? (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-primary text-fg-inverse">
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                  <span className="sr-only">Active theme</span>
                </span>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
