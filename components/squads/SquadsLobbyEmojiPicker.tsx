'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils/cn';

const QUICK = ['😀', '😂', '🔥', '👀', '🚀', '💯', '🫡', '❤️'] as const;
const GRID = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🙂', '😉',
  '😍', '🥳', '😎', '🤔', '😭', '😤', '👍', '👎',
  '🔥', '⚡', '💎', '🚀', '🌙', '👀', '💰', '🫡',
] as const;

export function SquadsLobbyEmojiPicker({
  open,
  onClose,
  onPick,
  anchorClassName,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
  anchorClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onClose]);

  if (!open) return null;

  const filtered = q.trim() ? GRID.filter(() => false) : GRID;

  return (
    <div
      ref={ref}
      className={cn(
        'absolute bottom-full right-0 z-20 mb-2 w-[min(280px,92vw)] overflow-hidden rounded-md border border-border-subtle bg-bg-raised/98 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.85)] backdrop-blur-xl',
        anchorClassName,
      )}
    >
      <div className="border-b border-border-subtle p-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search emoji…"
          className="w-full rounded-md border border-border-subtle bg-bg-sunken px-2.5 py-1.5 text-[12px] text-fg-primary placeholder:text-fg-muted focus:border-accent-primary/35 focus:outline-none"
        />
      </div>
      <div className="border-b border-border-subtle px-2 py-1.5">
        <p className="mb-1 px-0.5 text-[10px] font-medium text-fg-muted">Frequently used</p>
        <div className="flex flex-wrap gap-0.5">
          {QUICK.map((e) => (
            <EmojiBtn key={e} emoji={e} onPick={onPick} />
          ))}
        </div>
      </div>
      <div className="max-h-[140px] overflow-y-auto p-2">
        <p className="mb-1 px-0.5 text-[10px] font-medium text-fg-muted">Smileys</p>
        <div className="grid grid-cols-8 gap-0.5">
          {filtered.map((e) => (
            <EmojiBtn key={e} emoji={e} onPick={onPick} />
          ))}
        </div>
      </div>
    </div>
  );
}

function EmojiBtn({ emoji, onPick }: { emoji: string; onPick: (e: string) => void }) {
  return (
    <button
      type="button"
      className="flex h-8 w-8 items-center justify-center rounded-md text-[18px] transition hover:bg-bg-hover"
      onClick={() => onPick(emoji)}
    >
      {emoji}
    </button>
  );
}
