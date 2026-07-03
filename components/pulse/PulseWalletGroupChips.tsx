'use client';

import { useState } from 'react';
import { Check, FolderClosed, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import { useWalletGroupsStore } from '@/store/walletGroups';
import { useTradingStore } from '@/store/trading';
import type { StoredWalletGroup } from '@/lib/trade/walletGroups';

/**
 * Quick wallet-group selector for the Pulse header — click a group to switch the
 * active instant-trade wallets to that group's wallets (Axiom-style), no digging
 * into settings. Create groups inline; assign wallets in Portfolio → Wallets.
 */
export function PulseWalletGroupChips({ className }: { className?: string }) {
  const groups = useWalletGroupsStore((s) => s.groups);
  const activeGroupId = useWalletGroupsStore((s) => s.activeGroupId);
  const createGroup = useWalletGroupsStore((s) => s.createGroup);
  const setActiveGroupId = useWalletGroupsStore((s) => s.setActiveGroupId);
  const touchGroup = useWalletGroupsStore((s) => s.touchGroup);
  const setShortlist = useTradingStore((s) => s.setInstantTradeWalletShortlist);
  const clearShortlist = useTradingStore((s) => s.clearInstantTradeWalletShortlist);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const activate = (g: StoredWalletGroup) => {
    if (activeGroupId === g.id) {
      // Toggle off — back to your default/all wallets.
      setActiveGroupId(null);
      clearShortlist();
      toast.success('Cleared active group');
      return;
    }
    setActiveGroupId(g.id);
    touchGroup(g.id);
    setShortlist(g.walletAddresses);
    toast.success(
      g.walletAddresses.length
        ? `Trading with "${g.label}" · ${g.walletAddresses.length} wallet${g.walletAddresses.length === 1 ? '' : 's'}`
        : `"${g.label}" has no wallets yet — add them in Portfolio → Wallets`,
    );
  };

  const commitCreate = () => {
    const label = name.trim();
    if (!label) {
      setCreating(false);
      return;
    }
    const id = createGroup(label);
    setName('');
    setCreating(false);
    toast.success(`Group "${label}" created — add wallets in Portfolio → Wallets`);
    void id;
  };

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {groups.map((g) => {
        const active = activeGroupId === g.id;
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => activate(g)}
            title={
              active
                ? `Active — click to clear (${g.walletAddresses.length} wallets)`
                : `Trade with "${g.label}" (${g.walletAddresses.length} wallets)`
            }
            className={cn(
              'btn-press flex h-[26px] shrink-0 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold leading-none tracking-tight transition-colors',
              active
                ? 'border-accent-primary/45 bg-accent-primary/20 text-accent-primary'
                : 'border-white/[0.08] bg-bg-sunken/40 text-fg-muted hover:border-white/[0.16] hover:text-fg-secondary',
            )}
          >
            {active ? (
              <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
            ) : (
              <FolderClosed className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
            )}
            <span className="max-w-[7rem] truncate">{g.label}</span>
            <span className="tabular-nums opacity-60">{g.walletAddresses.length}</span>
          </button>
        );
      })}

      {creating ? (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitCreate();
            if (e.key === 'Escape') {
              setName('');
              setCreating(false);
            }
          }}
          onBlur={commitCreate}
          autoFocus
          placeholder="Group name…"
          className="h-[26px] w-28 shrink-0 rounded-md border border-accent-primary/40 bg-bg-sunken/60 px-2 text-[11px] text-fg-primary outline-none placeholder:text-fg-muted"
        />
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          title="Create wallet group"
          aria-label="Create wallet group"
          className="btn-press flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-bg-sunken/40 text-fg-muted transition-colors hover:border-accent-primary/40 hover:text-accent-primary"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        </button>
      )}
    </div>
  );
}
