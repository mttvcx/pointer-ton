'use client';

import { ImageIcon, Plus } from 'lucide-react';
import { PRESET_BACKGROUNDS } from '@/lib/share/backgrounds';
import type { ShareBackgroundPresetId } from '@/lib/share/types';
import { SHARE_IMAGE_MAX_BYTES } from '@/lib/share/types';
import { cn } from '@/lib/utils/cn';

export function ShareBackgroundPicker({
  selectedId,
  onSelect,
  onPickImageFile,
  disabled,
}: {
  selectedId: ShareBackgroundPresetId;
  onSelect: (id: ShareBackgroundPresetId) => void;
  onPickImageFile: (file: File) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 pt-1">
      {PRESET_BACKGROUNDS.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={disabled}
          title={p.label}
          onClick={() => onSelect(p.id)}
          className={cn(
            'relative h-14 w-24 shrink-0 overflow-hidden rounded-lg ring-2 ring-offset-2 ring-offset-[#05070c] transition',
            p.className,
            selectedId === p.id ? 'ring-accent-primary' : 'ring-transparent hover:ring-white/20',
          )}
        />
      ))}
      <label
        className={cn(
          'flex h-14 w-24 shrink-0 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border-subtle bg-black/30 text-[9px] text-fg-muted transition hover:border-accent-primary/40 hover:text-fg-secondary',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <Plus className="h-4 w-4" strokeWidth={2} />
        <span className="mt-0.5 flex items-center gap-1">
          <ImageIcon className="h-3 w-3" strokeWidth={2} />
          Upload
        </span>
        <span className="mt-0.5 px-1 text-center leading-tight">
          max {(SHARE_IMAGE_MAX_BYTES / (1024 * 1024)).toFixed(0)}MB
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) onPickImageFile(f);
          }}
        />
      </label>
    </div>
  );
}
