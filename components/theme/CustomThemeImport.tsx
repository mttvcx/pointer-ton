'use client';

import { useState } from 'react';
import { AlertCircle, Check, Upload } from 'lucide-react';
import {
  CustomThemeSchema,
  applyCustomTheme,
  saveCustomTheme,
} from '@/lib/theme/customTheme';
import { useTheme } from '@/components/theme/ThemeProvider';
import { cn } from '@/lib/utils/cn';

const PLACEHOLDER = `{
  "name": "My theme",
  "colors": {
    "bg-base": "#0a0a0b",
    "bg-raised": "#0a0a0b",
    "bg-sunken": "#060607",
    "bg-hover": "#16161a",
    "border-subtle": "#1c1c20",
    "border-default": "#26262c",
    "border-strong": "#36363e",
    "fg-primary": "#e5e7eb",
    "fg-secondary": "#9ca3af",
    "fg-muted": "#6b7280",
    "fg-inverse": "#0a0a0b",
    "accent-primary": "#9ca3af",
    "accent-glow": "#d1d5db",
    "signal-bull": "#3ddc97",
    "signal-bear": "#ff5e78",
    "signal-warn": "#ffb547",
    "signal-info": "#9ca3af"
  }
}`;

type Status =
  | { type: 'idle' }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string };

export function CustomThemeImport() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>({ type: 'idle' });
  const { setTheme } = useTheme();

  function handleApply() {
    try {
      const parsed: unknown = JSON.parse(text);
      const theme = CustomThemeSchema.parse(parsed);
      // Persist first so the SSR script can find it on next page load,
      // then write inline styles + flip data-theme="custom".
      saveCustomTheme(theme);
      applyCustomTheme(theme);
      setTheme('custom');
      setStatus({ type: 'success', message: `Applied "${theme.name}"` });
    } catch (err) {
      const message =
        err instanceof SyntaxError
          ? 'Invalid JSON — check brackets, commas, and quotes.'
          : err instanceof Error
            ? err.message
            : 'Could not apply theme.';
      setStatus({ type: 'error', message });
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (status.type !== 'idle') setStatus({ type: 'idle' });
        }}
        placeholder={PLACEHOLDER}
        rows={6}
        spellCheck={false}
        className={cn(
          'w-full resize-none rounded-md border border-border-subtle bg-bg-sunken px-3 py-2 text-xs font-mono text-fg-primary placeholder:text-fg-muted',
          'transition-colors focus:border-accent-primary/50 focus:outline-none focus:ring-1 focus:ring-accent-primary/20',
        )}
      />

      {status.type !== 'idle' ? (
        <div
          role={status.type === 'error' ? 'alert' : 'status'}
          className={cn(
            'flex items-start gap-2 rounded px-2 py-1.5 text-xs',
            status.type === 'success' && 'bg-signal-bull/10 text-signal-bull',
            status.type === 'error' && 'bg-signal-bear/10 text-signal-bear',
          )}
        >
          {status.type === 'success' ? (
            <Check className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
          ) : (
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
          )}
          <span className="leading-relaxed">{status.message}</span>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleApply}
        disabled={!text.trim()}
        className={cn(
          'flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-accent-primary text-sm font-semibold text-fg-inverse transition-colors',
          'hover:bg-accent-glow disabled:cursor-not-allowed disabled:opacity-40',
        )}
      >
        <Upload className="h-3.5 w-3.5" aria-hidden />
        Apply custom theme
      </button>
    </div>
  );
}
