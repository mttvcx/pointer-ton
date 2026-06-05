'use client';

import { cn } from '@/lib/utils/cn';
import type { ToastPosition } from '@/store/shellPrefs';

export const TOAST_POSITIONS: { id: ToastPosition; label: string }[] = [
  { id: 'top-left', label: 'Top Left' },
  { id: 'top-center', label: 'Top Center' },
  { id: 'top-right', label: 'Top Right' },
  { id: 'bottom-left', label: 'Bottom Left' },
  { id: 'bottom-center', label: 'Bottom Center' },
  { id: 'bottom-right', label: 'Bottom Right' },
];

/** Mini screen frame with a toast chip placed at the chosen corner/edge. */
export function ToastPositionPreview({
  position,
  selected,
}: {
  position: ToastPosition;
  selected: boolean;
}) {
  const placement = {
    'top-left': 'items-start justify-start pt-[18%] pl-[14%]',
    'top-center': 'items-start justify-center pt-[18%]',
    'top-right': 'items-start justify-end pt-[18%] pr-[14%]',
    'bottom-left': 'items-end justify-start pb-[18%] pl-[14%]',
    'bottom-center': 'items-end justify-center pb-[18%]',
    'bottom-right': 'items-end justify-end pb-[18%] pr-[14%]',
  }[position];

  return (
    <div
      className={cn(
        'relative aspect-[5/3] w-full overflow-hidden rounded-md border bg-[#0c0c0e] transition-colors',
        selected ? 'border-accent-primary' : 'border-white/[0.1] group-hover:border-white/[0.16]',
      )}
      aria-hidden
    >
      <div className="pointer-events-none absolute inset-[10%] rounded-[3px] border border-white/[0.04] bg-white/[0.02]" />
      <div className={cn('relative flex h-full w-full', placement)}>
        <div className="flex items-center gap-[3px] rounded-[3px] border border-white/[0.06] bg-[#141416] px-[5px] py-[3px] shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
          <span
            className={cn(
              'h-[5px] w-[5px] shrink-0 rounded-full',
              selected ? 'bg-accent-primary' : 'bg-white/30',
            )}
          />
          <span className="flex flex-col gap-[2px]">
            <span
              className={cn(
                'block h-[2px] rounded-full',
                selected ? 'w-[18px] bg-white/35' : 'w-[16px] bg-white/20',
              )}
            />
            <span
              className={cn(
                'block h-[2px] rounded-full',
                selected ? 'w-[12px] bg-white/22' : 'w-[10px] bg-white/14',
              )}
            />
          </span>
        </div>
      </div>
    </div>
  );
}

export function NotificationToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0 pt-0.5">
        <p className="text-[13px] font-medium leading-snug text-fg-primary">{label}</p>
        {description ? (
          <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">{description}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200',
          checked ? 'bg-accent-primary' : 'bg-white/12',
        )}
      >
        <span
          className={cn(
            'block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
            checked ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}

export function ToastPositionPicker({
  value,
  onChange,
}: {
  value: ToastPosition;
  onChange: (v: ToastPosition) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-[13px] font-medium text-fg-primary">Toast Position</p>
      <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Toast position">
        {TOAST_POSITIONS.map(({ id, label }) => {
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(id)}
              className="group flex flex-col items-center gap-1.5 text-left"
            >
              <ToastPositionPreview position={id} selected={selected} />
              <span
                className={cn(
                  'text-center text-[10px] font-medium leading-none',
                  selected ? 'text-fg-primary' : 'text-fg-muted',
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
