'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useOverlayPresence } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses } from '@/lib/ui/overlayMotion';
import { cn } from '@/lib/utils/cn';

export function SquadGlassModal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const { mounted, visible } = useOverlayPresence(open);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-[560] flex items-center justify-center p-4" role="dialog" aria-modal>
      <button
        type="button"
        className={cn(
          'absolute inset-0 bg-black/72 backdrop-blur-sm',
          overlayBackdropClasses(visible),
        )}
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative w-full max-w-md rounded-lg border border-[#252b36] bg-[#0d1117] p-4 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.85)]',
          visible ? 'opacity-100' : 'opacity-0',
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#1b2129] pb-3">
          <h2 className="text-[14px] font-semibold text-fg-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-fg-muted hover:bg-white/[0.06] hover:text-fg-primary"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>
        <div className="pt-3">{children}</div>
      </div>
    </div>
  );
}
