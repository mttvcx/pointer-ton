'use client';

import { Check } from 'lucide-react';
import { THEMES } from '@/lib/theme/themes';
import { useTheme } from '@/components/theme/ThemeProvider';
import { cn } from '@/lib/utils/cn';

export function ThemePicker() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {THEMES.map((t) => {
        const active = theme === t.id;
        const [base, mid, accent] = t.swatches;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setTheme(t.id)}
            aria-pressed={active}
            title={t.description}
            className={cn(
              'group relative flex flex-col items-center gap-2 rounded-xl border p-2.5 transition-colors',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-primary/40',
              active
                ? 'border-accent-primary bg-accent-primary/[0.06]'
                : 'border-border-subtle bg-bg-raised hover:border-white/[0.15] hover:bg-bg-hover',
            )}
          >
            {/* Clean diagonally-cut two-tone swatch + accent dot (base ↖ / mid ↘). */}
            <div
              className="relative h-11 w-full overflow-hidden rounded-md ring-1 ring-inset ring-white/10"
              style={{
                background: `linear-gradient(135deg, ${base} 0%, ${base} 49%, ${mid} 51%, ${mid} 100%)`,
              }}
              aria-hidden
            >
              <span
                className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-black/30"
                style={{ background: accent }}
              />
            </div>

            <div className="flex items-center gap-1">
              <span
                className={cn(
                  'text-xs font-semibold',
                  active ? 'text-fg-primary' : 'text-fg-secondary',
                )}
              >
                {t.label}
              </span>
              {active ? (
                <Check className="h-3 w-3 text-accent-primary" strokeWidth={3} aria-hidden />
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
