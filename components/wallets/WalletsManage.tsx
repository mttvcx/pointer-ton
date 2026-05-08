'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useCreateWallet, useExportWallet } from '@/lib/auth/solanaShims';
import { ArrowRightLeft, Copy, KeyRound, Loader2, MoreHorizontal, Pencil, Shield, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { useWalletBalancesPoll } from '@/lib/hooks/useWalletBalancesPoll';
import { explorerAddressUrl, shortenAddress } from '@/lib/utils/addresses';
import { formatNumber, lamportsToSol } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import { ImportWalletModal } from '@/components/wallets/ImportWalletModal';
import { useActiveWalletStore } from '@/store/activeWallet';

async function authJson<T>(
  token: string,
  url: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      json && typeof json === 'object' && 'message' in json
        ? String((json as { message: unknown }).message)
        : res.statusText;
    return { ok: false, status: res.status, message };
  }
  return { ok: true, data: json as T };
}

export function WalletsManage({ className }: { className?: string }) {
  const { authenticated, getAccessToken } = usePointerAuth();
  const qc = useQueryClient();
  const { createWallet } = useCreateWallet();
  const { exportWallet } = useExportWallet();
  const activeWalletAddress = useActiveWalletStore((s) => s.activeWalletAddress);
  const setActiveWalletAddress = useActiveWalletStore((s) => s.setActiveWalletAddress);
  const [creating, setCreating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [actionOpenId, setActionOpenId] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: ['wallets-my'],
    enabled: authenticated,
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await authJson<{ wallets: MyWalletRow[] }>(token, '/api/wallets/my');
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
  });

  const rowsForPoll = listQ.data?.wallets ?? [];
  const pollIds = useMemo(
    () => rowsForPoll.filter((r) => !r.is_archived).map((r) => r.id),
    [rowsForPoll],
  );

  useWalletBalancesPoll({
    enabled: authenticated && !listQ.isLoading && pollIds.length > 0,
    walletIds: pollIds,
    getAccessToken,
    queryClient: qc,
    intervalMs: 15_000,
  });

  useEffect(() => {
    if (!actionOpenId) return;
    function onDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[data-wallet-actions-root]')) return;
      setActionOpenId(null);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [actionOpenId]);

  const patchMutation = useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: Record<string, unknown>;
    }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await authJson<{ wallet: MyWalletRow }>(token, `/api/wallets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wallets-my'] });
    },
  });

  async function persistImportedPointerRow(address: string) {
    const token = await getAccessToken();
    if (!token) throw new Error('no_token');
    const res = await authJson<{ wallet: MyWalletRow }>(token, '/api/wallets/create', {
      method: 'POST',
      body: JSON.stringify({ wallet_address: address, is_imported: true }),
    });
    if (!res.ok) throw new Error(res.message);
    void qc.invalidateQueries({ queryKey: ['wallets-my'] });
    void qc.invalidateQueries({ queryKey: ['portfolio'] });
  }

  async function onExportKey(address: string) {
    try {
      await exportWallet({ address });
    } catch (e) {
      toast.error('Export did not complete', {
        description: e instanceof Error ? e.message.slice(0, 200) : 'Cancelled or unsupported wallet',
      });
    }
  }

  async function onCreateEmbedded() {
    setCreating(true);
    try {
      const { wallet: w } = await createWallet({ createAdditional: true });
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await authJson<{ wallet: MyWalletRow }>(token, '/api/wallets/create', {
        method: 'POST',
        body: JSON.stringify({ wallet_address: w.address }),
      });
      if (!res.ok) {
        throw new Error(res.message);
      }
      toast.success('Wallet created');
      void qc.invalidateQueries({ queryKey: ['wallets-my'] });
    } catch (e) {
      toast.error('Could not create wallet', {
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setCreating(false);
    }
  }

  if (!authenticated) {
    return (
      <div
        className={cn(
          'rounded-md border border-border-subtle bg-bg-base p-6 text-sm text-fg-secondary',
          className,
        )}
      >
        Sign in to manage wallets.
      </div>
    );
  }

  if (listQ.isLoading) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-fg-muted', className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading wallets...
      </div>
    );
  }

  const rows = listQ.data?.wallets ?? [];
  const activeRows = rows.filter((w) => w.is_active && !w.is_archived);
  const activeWallet = rows.find((w) => w.wallet_address === activeWalletAddress) ?? activeRows[0] ?? rows[0] ?? null;
  const activeBalance = activeWallet?.balance_lamports
    ? lamportsToSol(BigInt(activeWallet.balance_lamports))
    : 0;
  const linkedCount = rows.length;

  return (
    <>
      <ImportWalletModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={persistImportedPointerRow}
      />
      <div className={cn('flex min-h-0 flex-1 flex-col gap-2', className)}>
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-[#1b1f2a] bg-[#11141b] px-3 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[16px] font-semibold leading-tight text-white">Wallets</h1>
              <span className="rounded-full border border-[#1b1f2a] bg-[#080d14] px-2 py-0.5 text-[11px] text-[#9ca3af]">
                {rows.length} wallets
              </span>
              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                {activeRows.length} active
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-[#8b93a3]">Manage embedded and linked TON wallets</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={creating}
              onClick={() => void onCreateEmbedded()}
              className="btn-press focus-ring rounded-md bg-[#5865F2] px-2.5 py-1.5 text-[11px] font-semibold text-[#05070d] disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Embedded'}
            </button>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="focus-ring rounded-md border border-[#1b1f2a] bg-[#080d14] px-2.5 py-1.5 text-[11px] font-medium text-[#d1d5db] hover:bg-white/[0.04]"
            >
              Import
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-12 gap-2 overflow-hidden">
          <section className="col-span-12 flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#1b1f2a] bg-[#11141b] lg:col-span-8">
            <div className="grid grid-cols-[1.25fr_1.4fr_0.7fr_0.8fr_3rem] border-b border-[#1b1f2a] bg-[#151826] px-3 py-2 text-[11px] font-semibold text-[#6b7280]">
              <div>Wallet</div>
              <div>Address</div>
              <div className="text-right">Balance</div>
              <div className="text-right">Status</div>
              <div className="text-right">Actions</div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {rows.length === 0 ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 text-center text-[12px] text-[#8b93a3]">
                  <p className="font-semibold text-white">No wallets yet</p>
                  <p>Create or import a wallet to start trading.</p>
                  <button type="button" onClick={() => void onCreateEmbedded()} className="rounded-md bg-[#5865F2] px-3 py-1.5 text-[11px] font-semibold text-[#05070d]">
                    Create Embedded
                  </button>
                </div>
              ) : (
                rows.map((w, i) => {
                  const sol = w.balance_lamports ? lamportsToSol(BigInt(w.balance_lamports)) : 0;
                  const isActiveTrading = activeWalletAddress === w.wallet_address;
                  return (
                    <div
                      key={w.id}
                      className="grid grid-cols-[1.25fr_1.4fr_0.7fr_0.8fr_3rem] items-center border-b border-[#1b1f2a] px-3 py-2 text-[12px] last:border-b-0 hover:bg-white/[0.03]"
                      style={{ backgroundColor: i % 2 === 0 ? '#080d14' : '#121622' }}
                    >
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <WalletLabelEditor
                            wallet={w}
                            onSave={(label) => patchMutation.mutate({ id: w.id, body: { label } })}
                          />
                          {w.is_primary ? <span className="rounded-full bg-[#5865F2]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#8da2ff]">Primary</span> : null}
                          {isActiveTrading ? <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">Active wallet</span> : null}
                        </div>
                        {w.is_imported ? <div className="mt-0.5 text-[10px] text-[#8b93a3]">View-only imported key</div> : null}
                      </div>
                      <div className="flex min-w-0 items-center gap-1.5 text-[#9ca3af]">
                        <span className="truncate tabular-nums">{shortenAddress(w.wallet_address, 8)}</span>
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(w.wallet_address);
                            toast.success('Address copied');
                          }}
                          className="rounded p-1 text-[#6b7280] hover:bg-white/5 hover:text-white"
                          aria-label="Copy address"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="text-right">
                        <span className={cn('inline-flex rounded-full border px-2 py-1 text-[11px] tabular-nums', sol > 0 ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-[#1b1f2a] bg-[#080d14] text-[#9ca3af]')}>
                          {sol > 0 ? `${formatNumber(sol, { decimals: 4 })} TON` : 'No TON yet'}
                        </span>
                      </div>
                      <div className="flex justify-end gap-1">
                        <span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold', w.is_archived ? 'bg-amber-500/10 text-amber-300' : w.is_active ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-[#9ca3af]')}>
                          {w.is_archived ? 'Archived' : w.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="relative flex justify-end" data-wallet-actions-root>
                        <button
                          type="button"
                          onClick={() => setActionOpenId((id) => (id === w.id ? null : w.id))}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#1b1f2a] bg-[#080d14] text-[#9ca3af] hover:bg-white/[0.04] hover:text-white"
                          aria-label="Wallet actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {actionOpenId === w.id ? (
                          <div className="absolute right-0 top-8 z-30 w-36 overflow-hidden rounded-md border border-[#1b1f2a] bg-[#151826] p-1 shadow-2xl">
                            <button type="button" onClick={() => { setActiveWalletAddress(w.wallet_address); setActionOpenId(null); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-[#d1d5db] hover:bg-white/5"><Star className="h-3.5 w-3.5" /> Set active</button>
                            <button type="button" onClick={() => { toast.info('Click the wallet name to rename'); setActionOpenId(null); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-[#d1d5db] hover:bg-white/5"><Pencil className="h-3.5 w-3.5" /> Rename</button>
                            <button type="button" onClick={() => { void onExportKey(w.wallet_address); setActionOpenId(null); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-[#d1d5db] hover:bg-white/5"><KeyRound className="h-3.5 w-3.5" /> Export key</button>
                            <button type="button" disabled={patchMutation.isPending} onClick={() => { patchMutation.mutate({ id: w.id, body: { is_archived: !w.is_archived } }); setActionOpenId(null); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-[#d1d5db] hover:bg-white/5"><Shield className="h-3.5 w-3.5" /> {w.is_archived ? 'Unarchive' : 'Archive'}</button>
                            <button type="button" onClick={() => { toast.info('Delete wallet is not available yet'); setActionOpenId(null); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-[#fb7185] hover:bg-white/5"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <aside className="col-span-12 min-h-0 space-y-2 overflow-auto lg:col-span-4">
            <section className="rounded-lg border border-[#1b1f2a] bg-[#11141b] p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-white">Active Wallet</h2>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">Live</span>
              </div>
              {activeWallet ? (
                <div className="space-y-2">
                  <div>
                    <div className="font-semibold text-white">{activeWallet.label?.trim() || 'Untitled wallet'}</div>
                    <div className="mt-0.5 truncate text-[11px] tabular-nums text-[#8b93a3]">{shortenAddress(activeWallet.wallet_address, 10)}</div>
                  </div>
                  <div className="rounded-md border border-[#1b1f2a] bg-[#080d14] px-2 py-2">
                    <div className="text-[10px] text-[#6b7280]">Balance</div>
                    <div className="mt-0.5 text-[18px] font-semibold tabular-nums text-white">{formatNumber(activeBalance, { decimals: 4 })} TON</div>
                    {activeBalance <= 0 ? <div className="mt-1 text-[11px] text-[#8b93a3]">No TON yet. Deposit to active wallet.</div> : null}
                  </div>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => { void navigator.clipboard.writeText(activeWallet.wallet_address); toast.success('Address copied'); }} className="flex-1 rounded-md border border-[#1b1f2a] bg-[#080d14] px-2 py-1.5 text-[11px] text-[#d1d5db] hover:bg-white/[0.04]">Copy address</button>
                    <a href={explorerAddressUrl(activeWallet.wallet_address)} target="_blank" rel="noreferrer" className="flex-1 rounded-md border border-[#1b1f2a] bg-[#080d14] px-2 py-1.5 text-center text-[11px] text-[#d1d5db] hover:bg-white/[0.04]">Explorer</a>
                  </div>
                </div>
              ) : (
                <div className="text-[12px] text-[#8b93a3]">No active wallet selected.</div>
              )}
            </section>

            <section className="rounded-lg border border-[#1b1f2a] bg-[#11141b] p-3">
              <div className="mb-2 flex items-center gap-2"><ArrowRightLeft className="h-4 w-4 text-[#5865F2]" /><h2 className="text-[13px] font-semibold text-white">Distribution</h2></div>
              <p className="text-[12px] leading-snug text-[#9ca3af]">Move TON between wallets and consolidate low-balance accounts with safe execution preview.</p>
              <div className="mt-3 flex gap-1.5">
                <Link href="/portfolio" className="flex-1 rounded-md border border-[#1b1f2a] bg-[#080d14] px-2 py-1.5 text-center text-[11px] text-[#d1d5db] hover:bg-white/[0.04]">View Portfolio</Link>
                <Link href="/portfolio?tab=wallets" className="flex-1 rounded-md bg-[#5865F2] px-2 py-1.5 text-center text-[11px] font-semibold text-[#05070d]">Start transfer</Link>
              </div>
              <p className="mt-2 text-[10px] text-[#6b7280]">Transfers use your selected trading wallet and preview before execution.</p>
            </section>

            <section className="rounded-lg border border-[#1b1f2a] bg-[#11141b] p-3">
              <div className="mb-2 flex items-center gap-2"><Shield className="h-4 w-4 text-[#fb7185]" /><h2 className="text-[13px] font-semibold text-white">Security</h2></div>
              <div className="space-y-2 text-[12px] text-[#9ca3af]">
                <div className="flex justify-between"><span>Linked wallets</span><span className="font-semibold tabular-nums text-white">{linkedCount}</span></div>
                <div className="flex justify-between"><span>Imported keys</span><span className="font-semibold tabular-nums text-white">{rows.filter((w) => w.is_imported).length}</span></div>
                <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-2 text-[11px] text-amber-200">Export keys only on a trusted device. Keep a backup before archiving wallets.</div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}

function WalletLabelEditor({
  wallet,
  onSave,
}: {
  wallet: MyWalletRow;
  onSave: (label: string | null) => void;
}) {
  const [val, setVal] = useState(wallet.label ?? '');
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setVal(wallet.label ?? '');
          setEditing(true);
        }}
        className="truncate text-left text-[12px] font-medium text-fg-primary hover:text-accent-primary"
      >
        {wallet.label?.trim() || 'Untitled'}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const next = val.trim();
        const normalized = next.length ? next : null;
        if (normalized !== (wallet.label ?? null)) {
          onSave(normalized);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setEditing(false);
          setVal(wallet.label ?? '');
        }
      }}
      className="focus-ring w-full max-w-[200px] rounded border border-border-subtle bg-bg-base px-1.5 py-0.5 text-[12px] text-fg-primary"
    />
  );
}
