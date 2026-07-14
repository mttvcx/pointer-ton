'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Folder, Plus, Trash2 } from 'lucide-react';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import {
  UNGROUPED_GROUP_ID,
  groupViewsFromStore,
  ungroupedWalletAddresses,
  type StoredWalletGroup,
} from '@/lib/trade/walletGroups';
import { useWalletGroupsStore } from '@/store/walletGroups';
import { resolveWalletDisplayNames } from '@/lib/wallets/walletDisplayName';
import { cn } from '@/lib/utils/cn';

type Props = {
  wallets: MyWalletRow[];
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string | null) => void;
  className?: string;
};

export function WalletGroupsSidebar({
  wallets,
  selectedGroupId,
  onSelectGroup,
  className,
}: Props) {
  const groups = useWalletGroupsStore((s) => s.groups);
  const createGroup = useWalletGroupsStore((s) => s.createGroup);
  const renameGroup = useWalletGroupsStore((s) => s.renameGroup);
  const deleteGroup = useWalletGroupsStore((s) => s.deleteGroup);
  const toggleWalletInGroup = useWalletGroupsStore((s) => s.toggleWalletInGroup);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');

  const knownAddresses = useMemo(
    () => new Set(wallets.map((w) => w.wallet_address)),
    [wallets],
  );
  const walletNames = useMemo(() => resolveWalletDisplayNames(wallets), [wallets]);
  const allAddresses = useMemo(() => wallets.map((w) => w.wallet_address), [wallets]);
  const ungroupedCount = useMemo(
    () => ungroupedWalletAddresses(allAddresses, groups).length,
    [allAddresses, groups],
  );

  const groupViews = useMemo(
    () => groupViewsFromStore(groups, knownAddresses, true, ungroupedCount),
    [groups, knownAddresses, ungroupedCount],
  );

  const onCreate = () => {
    const name = draftName.trim();
    if (!name) return;
    const id = createGroup(name);
    setDraftName('');
    setCreating(false);
    onSelectGroup(id);
    setExpandedId(id);
  };

  return (
    <div className={cn('flex min-h-0 flex-col border-b border-border-subtle/80', className)}>
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-fg-muted">
            Wallet groups
          </p>
          <p className="mt-0.5 text-[10px] text-fg-muted">Used in instant trade · tap to filter</p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-bg-sunken px-2 py-1 text-[10px] font-semibold text-fg-secondary transition hover:bg-bg-hover hover:text-fg-primary"
        >
          <Plus className="h-3 w-3" strokeWidth={2.2} />
          New
        </button>
      </div>

      {creating ? (
        <div className="flex shrink-0 items-center gap-1.5 px-3 pb-2">
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCreate();
              if (e.key === 'Escape') {
                setCreating(false);
                setDraftName('');
              }
            }}
            placeholder="Group name (e.g. 4K MC)"
            className="min-w-0 flex-1 rounded-md border border-border-subtle bg-bg-sunken px-2 py-1 text-[11px] text-fg-primary outline-none placeholder:text-fg-muted focus:border-accent-primary/40"
            autoFocus
          />
          <button
            type="button"
            onClick={onCreate}
            disabled={!draftName.trim()}
            className="rounded-md bg-accent-primary px-2 py-1 text-[10px] font-semibold text-fg-inverse disabled:opacity-40"
          >
            Add
          </button>
        </div>
      ) : null}

      <div className="min-h-0 max-h-44 space-y-0.5 overflow-y-auto overscroll-contain px-2 pb-2 [scrollbar-width:thin]">
        {groupViews.length === 0 ? (
          <p className="px-1 py-2 text-[11px] text-fg-muted">
            No groups yet — create one to bundle wallets for instant trade.
          </p>
        ) : (
          groupViews.map((g) => {
            const isUngrouped = g.id === UNGROUPED_GROUP_ID;
            const selected = selectedGroupId === g.id;
            const expanded = expandedId === g.id;

            return (
              <div key={g.id}>
                <div
                  className={cn(
                    'flex items-center gap-1 rounded-lg px-1.5 py-1.5 ring-1 ring-inset transition-colors',
                    selected
                      ? 'bg-accent-primary/12 ring-accent-primary/30'
                      : 'ring-transparent hover:bg-white/[0.04]',
                  )}
                >
                  {!isUngrouped ? (
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : g.id)}
                      className="rounded p-0.5 text-fg-muted hover:text-fg-secondary"
                      aria-label={expanded ? 'Collapse group' : 'Expand group'}
                    >
                      {expanded ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </button>
                  ) : (
                    <span className="w-4" />
                  )}
                  <button
                    type="button"
                    onClick={() => onSelectGroup(isUngrouped ? UNGROUPED_GROUP_ID : g.id)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                  >
                    <Folder
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        selected ? 'text-accent-glow' : 'text-accent-primary/70',
                      )}
                      strokeWidth={2}
                    />
                    <span className="truncate text-[11px] font-medium text-fg-primary">{g.label}</span>
                    <span className="ml-auto shrink-0 rounded-full bg-white/[0.06] px-1.5 py-0.5 tabular-nums text-[10px] text-fg-muted">
                      {g.walletCount}
                    </span>
                  </button>
                  {!isUngrouped ? (
                    <button
                      type="button"
                      onClick={() => deleteGroup(g.id)}
                      className="rounded p-0.5 text-fg-muted hover:text-signal-bear"
                      aria-label={`Delete ${g.label}`}
                      title="Delete group"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  ) : null}
                </div>

                {expanded && !isUngrouped ? (
                  <div className="ml-5 mr-1 mt-0.5 space-y-0.5 border-l border-border-subtle/60 pl-2">
                    <RenameInline
                      label={groups.find((x) => x.id === g.id)?.label ?? g.label}
                      onSave={(label) => renameGroup(g.id, label)}
                    />
                    {wallets.length === 0 ? (
                      <p className="py-1 text-[10px] text-fg-muted">No wallets on this chain.</p>
                    ) : (
                      wallets.map((w) => {
                        const inGroup = groups
                          .find((x) => x.id === g.id)
                          ?.walletAddresses.includes(w.wallet_address);
                        const label = walletNames.get(w.id) ?? w.label?.trim() ?? 'Pointer Wallet';
                        return (
                          <label
                            key={w.id}
                            className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-[10px] hover:bg-bg-hover"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(inGroup)}
                              onChange={() => toggleWalletInGroup(g.id, w.wallet_address)}
                              className="h-3 w-3 rounded border-border-subtle"
                            />
                            <span className="truncate text-fg-secondary">{label}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function RenameInline({ label, onSave }: { label: string; onSave: (label: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(label);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setVal(label);
          setEditing(true);
        }}
        className="mb-1 text-[10px] text-fg-muted underline-offset-2 hover:text-fg-secondary hover:underline"
      >
        Rename “{label}”
      </button>
    );
  }

  return (
    <div className="mb-1 flex items-center gap-1">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onSave(val);
            setEditing(false);
          }
          if (e.key === 'Escape') setEditing(false);
        }}
        className="min-w-0 flex-1 rounded border border-border-subtle bg-bg-base px-1.5 py-0.5 text-[10px] text-fg-primary outline-none"
        autoFocus
      />
      <button
        type="button"
        onClick={() => {
          onSave(val);
          setEditing(false);
        }}
        className="text-[10px] font-semibold text-accent-primary"
      >
        Save
      </button>
    </div>
  );
}

/** Filter wallet rows by the portfolio group selection. */
export function filterWalletsByGroup(
  wallets: MyWalletRow[],
  groupId: string | null,
  groups: StoredWalletGroup[],
): MyWalletRow[] {
  if (!groupId || groupId === UNGROUPED_GROUP_ID) {
    if (groupId === UNGROUPED_GROUP_ID) {
      const addrs = new Set(
        ungroupedWalletAddresses(
          wallets.map((w) => w.wallet_address),
          groups,
        ),
      );
      return wallets.filter((w) => addrs.has(w.wallet_address));
    }
    return wallets;
  }
  const group = groups.find((g) => g.id === groupId);
  if (!group) return wallets;
  const set = new Set(group.walletAddresses);
  return wallets.filter((w) => set.has(w.wallet_address));
}
