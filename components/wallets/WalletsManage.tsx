'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { ArrowRightLeft, Copy, Eye, EyeOff, KeyRound, Loader2, MoreHorizontal, Pencil, Shield, Star } from 'lucide-react';
import { toast } from 'sonner';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { useWalletBalancesPoll } from '@/lib/hooks/useWalletBalancesPoll';
import { dispatchSolanaAccountRefresh } from '@/lib/client/portfolioRefreshEvents';
import { explorerAccountUrlForChain } from '@/lib/chains/explorer';
import { mintMatchesAppChain } from '@/lib/chains/mintKind';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { useUIStore } from '@/store/ui';
import { shortenAddress } from '@/lib/utils/addresses';
import { formatNumber, lamportsToSol } from '@/lib/utils/formatters';
import { useOverlayPresence } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
import { cn } from '@/lib/utils/cn';
import { ImportWalletModal } from '@/components/wallets/ImportWalletModal';
import { OS, WalletMonogram, WalletTableRowShell } from '@/components/portfolio/walletOs';
import { useActiveWalletStore } from '@/store/activeWallet';
import { generateEmbeddedWalletForChain } from '@/lib/wallets/embeddedCreate';

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
  const activeChain = useUIStore((s) => s.activeChain);
  const nativeSym = nativeTicker(activeChain);
  const qc = useQueryClient();
  const activeWalletAddress = useActiveWalletStore((s) => s.activeWalletAddress);
  const setActiveWalletAddress = useActiveWalletStore((s) => s.setActiveWalletAddress);
  const [creating, setCreating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [newWalletPrivateKey, setNewWalletPrivateKey] = useState<string | null>(null);
  const [newWalletAddress, setNewWalletAddress] = useState<string | null>(null);
  const [revealPrivateKey, setRevealPrivateKey] = useState(false);
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
    dispatchSolanaAccountRefresh('wallet_import');
  }

  function onExportKeyInfo(w: MyWalletRow) {
    if (w.is_imported) {
      toast.info('Private key isn’t stored in Pointer', {
        description:
          'Embedded / imported rows only save your address. Use the private key or phrase you copied when you created or imported this wallet.',
      });
      return;
    }
    toast.info('Linked TonConnect wallet', {
      description:
        'Your keys stay in your TON wallet app (Tonkeeper, etc.). Open it there to view seed / backup — Pointer never receives your phrase for linked wallets.',
    });
  }

  async function onCreateEmbedded() {
    setCreating(true);
    try {
      const { address, privateKeyDisplay } = await generateEmbeddedWalletForChain(activeChain);
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await authJson<{ wallet: MyWalletRow }>(token, '/api/wallets/create', {
        method: 'POST',
        body: JSON.stringify({ wallet_address: address, is_imported: true, label: 'Embedded' }),
      });
      if (!res.ok) {
        if (res.status === 409) {
          toast.info('This wallet is already on your account');
          return;
        }
        throw new Error(res.message);
      }
      setNewWalletAddress(address);
      setNewWalletPrivateKey(privateKeyDisplay);
      setRevealPrivateKey(false);
      setActiveWalletAddress(address);
      toast.success('Wallet created — save your private key offline');
      void qc.invalidateQueries({ queryKey: ['wallets-my'] });
      void qc.invalidateQueries({ queryKey: ['portfolio'] });
      dispatchSolanaAccountRefresh('wallet_create');
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
  const chainRows = rows.filter((w) => mintMatchesAppChain(w.wallet_address, activeChain));
  const activeRows = chainRows.filter((w) => w.is_active && !w.is_archived);
  const activeWallet =
    chainRows.find((w) => w.wallet_address === activeWalletAddress) ?? activeRows[0] ?? null;
  const activeBalance = activeWallet?.balance_lamports
    ? lamportsToSol(BigInt(activeWallet.balance_lamports))
    : 0;
  const linkedCount = chainRows.length;

  const keyRevealOpen = Boolean(newWalletPrivateKey && newWalletAddress);
  const { mounted: keyRevealMounted, visible: keyRevealVisible } = useOverlayPresence(keyRevealOpen);

  return (
    <>
      <ImportWalletModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={persistImportedPointerRow}
      />
      {keyRevealMounted && newWalletPrivateKey && newWalletAddress ? (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            className={cn(
              'absolute inset-0 bg-black/70 backdrop-blur-sm',
              overlayBackdropClasses(keyRevealVisible),
              'fill-mode-forwards',
            )}
            aria-label="Dismiss"
            onClick={() => {
              setNewWalletPrivateKey(null);
              setNewWalletAddress(null);
              setRevealPrivateKey(false);
            }}
          />
          <div
            className={cn(
              'relative z-[1] max-h-[min(90dvh,640px)] w-full max-w-lg overflow-y-auto rounded-xl border border-[#1b1f2a] bg-[#11141b] p-4 shadow-2xl fill-mode-forwards',
              overlayPanelClasses(keyRevealVisible),
            )}
            role="dialog"
            aria-modal
            aria-label="Save private key"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 className="text-[15px] font-semibold text-white">Save your private key</h2>
            <p className="mt-2 text-[12px] leading-snug text-[#9ca3af]">
              This backs up{' '}
              <span className="tabular-nums text-fg-primary">{shortenAddress(newWalletAddress, 6)}</span>
              {activeChain === 'sol'
                ? ' (Solana base58 secret key). '
                : activeChain === 'ton'
                  ? ' (TON key as hex). '
                  : activeChain === 'bnb' || activeChain === 'base'
                    ? ' (EVM hex private key). '
                    : '. '}
              Store it offline. Anyone with this key controls the wallet.
            </p>
            <div
              className={cn(
                'mt-3 rounded-lg border border-[#1b1f2a] bg-[#080d14] p-3 font-mono text-[11px] leading-relaxed text-[#d1d5db] transition-all duration-150',
                !revealPrivateKey && 'blur-md select-none',
              )}
            >
              {newWalletPrivateKey}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-[#1b1f2a] bg-[#080d14] px-3 py-1.5 text-[11px] font-semibold text-[#d1d5db] hover:bg-white/[0.04]"
                onClick={() => setRevealPrivateKey((v) => !v)}
              >
                {revealPrivateKey ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" />
                    Hide key
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    Reveal key
                  </>
                )}
              </button>
              <button
                type="button"
                className="rounded-md bg-[#5865F2] px-3 py-1.5 text-[11px] font-semibold text-[#05070d]"
                onClick={() => {
                  void navigator.clipboard.writeText(newWalletPrivateKey);
                  toast.success('Private key copied');
                }}
              >
                Copy key
              </button>
              <button
                type="button"
                className="rounded-md border border-[#1b1f2a] bg-[#080d14] px-3 py-1.5 text-[11px] text-[#d1d5db] hover:bg-white/[0.04]"
                onClick={() => {
                  setNewWalletPrivateKey(null);
                  setNewWalletAddress(null);
                  setRevealPrivateKey(false);
                }}
              >
                I saved it — dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className={cn('flex min-h-0 flex-1 flex-col gap-2', className)}>
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle/80 bg-bg-elevated px-3 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[16px] font-semibold leading-tight text-white">Wallets</h1>
              <span className="rounded-full border border-[#1b1f2a] bg-[#080d14] px-2 py-0.5 text-[11px] text-[#9ca3af]">
                {chainRows.length} wallets
              </span>
              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                {activeRows.length} active
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-[#8b93a3]">
              Embedded, imported, and linked wallets for this chain. Set which wallet executes trades.
            </p>
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
          <section className="col-span-12 flex min-h-0 flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated lg:col-span-8">
            <div className="grid grid-cols-[1.25fr_1.4fr_0.7fr_0.8fr_3rem] border-b border-border-subtle bg-bg-base px-3 py-2 text-[11px] font-semibold tracking-tight text-[#64748b]">
              <div>Wallet</div>
              <div>Address</div>
              <div className="text-right">Balance</div>
              <div className="text-right">Status</div>
              <div className="text-right">Actions</div>
            </div>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-auto px-1.5 pb-2 pt-1.5 [scrollbar-width:thin]">
              {chainRows.length === 0 ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 text-center text-[12px] text-[#8b93a3]">
                  <p className="font-semibold text-white">No {nativeSym} wallets yet</p>
                  <p>Create or import a wallet for this chain to start trading.</p>
                  <button type="button" onClick={() => void onCreateEmbedded()} className="rounded-md bg-[#5865F2] px-3 py-1.5 text-[11px] font-semibold text-[#05070d]">
                    Create Embedded
                  </button>
                </div>
              ) : (
                chainRows.map((w) => {
                  const sol = w.balance_lamports ? lamportsToSol(BigInt(w.balance_lamports)) : 0;
                  const isActiveTrading = activeWalletAddress === w.wallet_address;
                  return (
                    <WalletTableRowShell key={w.id} selected={isActiveTrading} className="px-2 py-1.5">
                      <div className="grid grid-cols-[1.25fr_1.4fr_0.7fr_0.8fr_3rem] items-center gap-1 text-[12px]">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <WalletMonogram address={w.wallet_address} label={w.label} />
                          <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <WalletLabelEditor
                            wallet={w}
                            onSave={(label) => patchMutation.mutate({ id: w.id, body: { label } })}
                          />
                          {w.is_primary ? <span className="shrink-0 rounded-full border border-[#4a62d6]/35 bg-[#2f3f8a]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#8da2ff]">Primary</span> : null}
                          {isActiveTrading ? <span className="shrink-0 rounded-full border border-cyan-900/40 bg-cyan-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200/95">Trading</span> : null}
                        </div>
                        {w.is_imported ? <div className="mt-0.5 text-[10px] text-[#8b93a3]">Imported key</div> : <div className="mt-0.5 text-[10px] text-[#6d8098]">Embedded</div>}
                          </div>
                        </div>
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
                          {formatNumber(sol, { decimals: 4 })} {nativeSym}
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
                          <div className={cn(
                            'absolute right-0 top-8 z-30 w-40 overflow-hidden rounded-xl p-1 shadow-2xl animate-in fade-in zoom-in-95 duration-150',
                            OS.border,
                            OS.glass,
                          )}
                          >
                            <button type="button" onClick={() => { setActiveWalletAddress(w.wallet_address); setActionOpenId(null); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-[#d1d5db] hover:bg-white/[0.06]"><Star className="h-3.5 w-3.5" /> Set primary</button>
                            <button type="button" onClick={() => { toast.info('Click the wallet name to rename'); setActionOpenId(null); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-[#d1d5db] hover:bg-white/[0.06]"><Pencil className="h-3.5 w-3.5" /> Rename</button>
                            <button type="button" onClick={() => { onExportKeyInfo(w); setActionOpenId(null); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-[#d1d5db] hover:bg-white/[0.06]"><KeyRound className="h-3.5 w-3.5" /> Export key</button>
                            <button type="button" disabled={patchMutation.isPending} onClick={() => { patchMutation.mutate({ id: w.id, body: { is_archived: !w.is_archived } }); setActionOpenId(null); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-[#d1d5db] hover:bg-white/[0.06]"><Shield className="h-3.5 w-3.5" /> {w.is_archived ? 'Unarchive' : 'Archive'}</button>
                            {/* Delete intentionally omitted — archive is the supported removal path. */}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    </WalletTableRowShell>
                  );
                })
              )}
            </div>
          </section>

          <aside className="col-span-12 min-h-0 space-y-2 overflow-auto lg:col-span-4">
            <section className="rounded-lg border border-border-subtle bg-bg-elevated p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-white">Active wallet</h2>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">Trading</span>
              </div>
              {activeWallet ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-2.5">
                    <WalletMonogram address={activeWallet.wallet_address} label={activeWallet.label} />
                    <div className="min-w-0">
                    <div className="font-semibold text-white">{activeWallet.label?.trim() || 'Untitled wallet'}</div>
                    <div className="mt-0.5 truncate text-[11px] tabular-nums text-[#8b93a3]">{shortenAddress(activeWallet.wallet_address, 10)}</div>
                    </div>
                  </div>
                  <div className="rounded-md border border-[#1b1f2a] bg-[#080d14] px-2 py-2">
                <div className="text-[10px] text-[#64748b]">Balance</div>
                    <div className="mt-0.5 text-[18px] font-semibold tabular-nums text-white">
                      {formatNumber(activeBalance, { decimals: 4 })} {nativeSym}
                    </div>
                    {activeBalance <= 0 ? (
                      <div className="mt-1 text-[11px] text-[#8b93a3]">
                        No {nativeSym} yet. Deposit to your primary wallet.
                      </div>
                    ) : null}
                  </div>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => { void navigator.clipboard.writeText(activeWallet.wallet_address); toast.success('Address copied'); }} className="flex-1 rounded-md border border-[#1b1f2a] bg-[#080d14] px-2 py-1.5 text-[11px] text-[#d1d5db] hover:bg-white/[0.04]">Copy address</button>
                    <a href={explorerAccountUrlForChain(activeWallet.wallet_address, activeChain)} target="_blank" rel="noreferrer" className="flex-1 rounded-md border border-[#1b1f2a] bg-[#080d14] px-2 py-1.5 text-center text-[11px] text-[#d1d5db] hover:bg-white/[0.04]">Explorer</a>
                  </div>
                </div>
              ) : (
                <div className="text-[12px] text-[#8b93a3]">Pick a wallet to route capital and sign swaps.</div>
              )}
            </section>

            <section className="rounded-lg border border-border-subtle bg-bg-elevated p-3">
              <div className="mb-2 flex items-center gap-2"><ArrowRightLeft className="h-4 w-4 text-[#5865F2]" /><h2 className="text-[13px] font-semibold text-white">Capital routing</h2></div>
              <p className="text-[12px] leading-snug text-[#9ca3af]">
                Move balances between wallets with a preview split before you send. Heavy flows run from Portfolio.
              </p>
              <div className="mt-3 flex gap-1.5">
                <Link href="/portfolio" className="flex-1 rounded-md border border-[#1b1f2a] bg-[#080d14] px-2 py-1.5 text-center text-[11px] text-[#d1d5db] hover:bg-white/[0.04]">View Portfolio</Link>
                <Link href="/portfolio?tab=wallets" className="flex-1 rounded-md bg-[#5865F2] px-2 py-1.5 text-center text-[11px] font-semibold text-[#05070d]">Start transfer</Link>
              </div>
              <p className="mt-2 text-[10px] text-[#64748b]">Uses your active trading wallet with an on-screen preview before broadcast.</p>
            </section>

            <section className="rounded-lg border border-border-subtle bg-bg-elevated p-3">
              <div className="mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#fb7185]" />
                <h2 className="text-[13px] font-semibold text-white">Security</h2>
              </div>
              <div className="space-y-2 text-[12px] text-[#9ca3af]">
                <div className="flex justify-between"><span>Linked wallets</span><span className="font-semibold tabular-nums text-white">{linkedCount}</span></div>
                <div className="flex justify-between">
                  <span>Imported keys</span>
                  <span className="font-semibold tabular-nums text-white">
                    {chainRows.filter((w) => w.is_imported).length}
                  </span>
                </div>
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
