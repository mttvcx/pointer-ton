'use client';

import { cn } from '@/lib/utils/cn';
import { useTradingStore, type PresetSlot } from '@/store/trading';

export type PresetRow = {
  slot: PresetSlot;
  name: string;
};

type Props = {
  presets: PresetRow[];
  onEdit: () => void;
  onAdvancedSettings: () => void;
  disabled?: boolean;
};

export function PresetSelector({ presets, onEdit, onAdvancedSettings, disabled }: Props) {
  const { activePresetSlot, setActivePresetSlot } = useTradingStore();
  const bySlot = new Map(presets.map((p) => [p.slot, p.name] as const));

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-[9px] font-semibold uppercase tracking-wide text-fg-muted">
        Preset
      </span>
      {([1, 2, 3] as const).map((slot) => (
        <button
          key={slot}
          type="button"
          disabled={disabled}
          title={bySlot.get(slot) ?? undefined}
          onClick={() => setActivePresetSlot(slot)}
          className={cn(
            'btn-press focus-ring rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-all duration-150',
            activePresetSlot === slot
              ? 'border-accent-primary/50 bg-accent-primary/10 text-accent-primary'
              : 'border-border-subtle text-fg-muted hover:border-border-default hover:text-fg-secondary',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          PRESET {slot}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={onAdvancedSettings}
        className="text-[10px] font-medium text-fg-muted underline-offset-2 transition hover:text-fg-secondary hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
      >
        Fees
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onEdit}
        className="text-[10px] font-medium text-fg-muted underline-offset-2 transition hover:text-fg-secondary hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
      >
        Edit
      </button>
    </div>
  );
}
