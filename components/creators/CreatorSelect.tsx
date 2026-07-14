'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export type CreatorSelectOption = {
  value: string;
  label: string;
  hint?: string;
};

/**
 * Real, on-brand dropdown for the Creator Portal — replaces the native <select>
 * (which renders the OS chrome and breaks the glass aesthetic). Keyboard- and
 * click-outside-aware, glass menu, animated open.
 */
export function CreatorSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: CreatorSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value) ?? null;

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const i = options.findIndex((o) => o.value === value);
      setActiveIndex(i >= 0 ? i : 0);
    }
  }, [open, options, value]);

  function commit(i: number) {
    const opt = options[i];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
  }

  function onButtonKey(e: React.KeyboardEvent) {
    if (disabled) return;
    if ((e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') && !open) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commit(activeIndex);
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        data-open={open}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onButtonKey}
        className={cn(
          'creator-field flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-fg-primary',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span className={cn('truncate', !selected && 'text-fg-muted')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronsUpDown
          className={cn('h-3.5 w-3.5 shrink-0 text-fg-muted transition-transform', open && 'text-accent-glow')}
          strokeWidth={2}
        />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="creator-menu absolute z-50 mt-1.5 max-h-64 w-full overflow-auto rounded-lg p-1"
        >
          {options.map((o, i) => {
            const isSel = o.value === value;
            const isActive = i === activeIndex;
            return (
              <li key={o.value} role="option" aria-selected={isSel}>
                <button
                  type="button"
                  onClick={() => commit(i)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors',
                    isActive ? 'bg-accent-primary/15 text-fg-primary' : 'text-fg-secondary',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{o.label}</span>
                    {o.hint ? <span className="block truncate text-[11px] text-fg-muted">{o.hint}</span> : null}
                  </span>
                  {isSel ? <Check className="h-3.5 w-3.5 shrink-0 text-accent-glow" strokeWidth={2.5} /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
