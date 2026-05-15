'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { ArrowDownToLine, ChevronDown, ExternalLink, LogOut, Search, Settings } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { CopilotToggleButton } from '@/components/layout/AICopilotPanel';
import { ChainSelectDropdown } from '@/components/layout/ChainSelectDropdown';
import { CopilotHeaderBar } from '@/components/ai/CopilotHeaderBar';
import { WebPushControls } from '@/components/layout/WebPushControls';
import { APP_NAV } from '@/components/layout/navConfig';
import { DepositHistoryModal } from '@/components/wallet/DepositHistoryModal';
import { ExchangeModal } from '@/components/wallet/ExchangeModal';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { DisplayPopover } from '@/components/preferences/DisplayPopover';
import { WalletBalancePopover } from '@/components/wallet/WalletBalancePopover';
import { USDC_MINT_MAINNET } from '@/components/wallet/walletFundingConstants';
import { useUIStore } from '@/store/ui';
import { shortenAddress } from '@/lib/utils/addresses';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { useActiveSolanaWallet } from '@/lib/hooks/useActiveSolanaWallet';
import { cn } from '@/lib/utils/cn';
import { explorerAccountUrlForChain } from '@/lib/chains/explorer';
import { mintMatchesAppChain } from '@/lib/chains/mintKind';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { formatNumber, parseLamportsStringToSol, rawToUi } from '@/lib/utils/formatters';
import { useOverlayPresence, POPOVER_ANIM_CLOSE_MS } from '@/lib/hooks/useOverlayPresence';
import { popoverPanelClasses } from '@/lib/ui/overlayMotion';

function topbarAvatarInitials(wallet: string | null | undefined, userId: string | null | undefined): string {
  const raw = (wallet ?? userId ?? '').trim();
  if (!raw) return '?';
  // TON raw "workchain:hex" — avoid showing "0:" from slice(0, 2).
  if (/^(-?\d+):[a-fA-F0-9]+$/.test(raw)) {
    const hex = raw.replace(/^-?\d+:/, '').replace(/^0+/, '') || '0';
    return hex.slice(0, 2).toUpperCase();
  }
  const alnum = raw.replace(/[^a-zA-Z0-9]/g, '');
  if (alnum.length >= 2) return alnum.slice(0, 2).toUpperCase();
  return raw.slice(0, 2).toUpperCase();
}

/**
 * App topbar: brand, primary nav, search, chain pill, deposit, co-pilot, wallet.
 * Height matches --app-topbar-h; full-width layout (no left sidebar).
 */
export function Topbar() {
  const pathname = usePathname();
  const { authenticated, user, logout, getAccessToken, login, linkedTonAddress } = usePointerAuth();
  const searchQuery = useUIStore((s) => s.searchQuery);
  const searchOpen = useUIStore((s) => s.searchOpen);
  const setSearchOpen = useUIStore((s) => s.setSearchOpen);
  const activeChain = useUIStore((s) => s.activeChain);
  const nativeSym = nativeTicker(activeChain);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [balancePopoverOpen, setBalancePopoverOpen] = useState(false);
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [depositHistoryOpen, setDepositHistoryOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const walletMenuRef = useRef<HTMLDivElement>(null);
  const balanceAnchorRef = useRef<HTMLButtonElement>(null);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const walletMenuPresence = useOverlayPresence(walletMenuOpen, POPOVER_ANIM_CLOSE_MS);
  const avatarMenuPresence = useOverlayPresence(avatarMenuOpen, POPOVER_ANIM_CLOSE_MS);

  const myWalletsQ = useQuery({
    queryKey: ['wallets-my'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/wallets/my', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('wallets');
      return res.json() as Promise<{ wallets: MyWalletRow[] }>;
    },
    enabled: authenticated,
    staleTime: 30_000,
  });

  const { activeAddress, setActiveWalletAddress, ready: walletsReady, canSignWithWallet } =
    useActiveSolanaWallet(myWalletsQ.data?.wallets);
  const walletAddress = activeAddress;

  const walletsForChain = useMemo(
    () =>
      (myWalletsQ.data?.wallets ?? []).filter((w) =>
        mintMatchesAppChain(w.wallet_address, activeChain),
      ),
    [myWalletsQ.data?.wallets, activeChain],
  );

  useEffect(() => {
    if (!walletMenuOpen) return;
    function onDoc(e: MouseEvent) {
      if (walletMenuRef.current?.contains(e.target as Node)) return;
      setWalletMenuOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [walletMenuOpen]);

  useEffect(() => {
    if (!avatarMenuOpen) return;
    function onDoc(e: MouseEvent) {
      if (avatarMenuRef.current?.contains(e.target as Node)) return;
      setAvatarMenuOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [avatarMenuOpen]);

  const portfolioQ = useQuery({
    queryKey: ['portfolio', walletAddress],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const q = walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : '';
      const res = await fetch(`/api/portfolio${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('portfolio');
      return res.json() as Promise<{
        solLamports: string | null;
        solUsd: number | null;
        holdings: Array<{
          mint: string;
          rawAmount: string;
          decimals: number;
          symbol: string | null;
        }>;
      }>;
    },
    enabled: Boolean(
      authenticated &&
        walletsReady &&
        walletAddress &&
        activeChain === 'sol' &&
        mintMatchesAppChain(walletAddress, 'sol'),
    ),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  const solUi = parseLamportsStringToSol(portfolioQ.data?.solLamports);

  const tonBalanceUi = useMemo(() => {
    if (activeChain !== 'ton' || !walletAddress) return null;
    const row = myWalletsQ.data?.wallets?.find((w) => w.wallet_address === walletAddress);
    return parseLamportsStringToSol(row?.balance_lamports ?? null) ?? 0;
  }, [activeChain, walletAddress, myWalletsQ.data?.wallets]);

  const headerNativeUi = activeChain === 'sol' ? solUi : activeChain === 'ton' ? tonBalanceUi : null;

  const usdcUi = useMemo(() => {
    const h = portfolioQ.data?.holdings?.find((x) => x.mint === USDC_MINT_MAINNET);
    if (!h) return 0;
    return rawToUi(h.rawAmount, h.decimals);
  }, [portfolioQ.data?.holdings]);

  const totalUsd = useMemo(() => {
    if (activeChain !== 'sol') return null;
    const px = portfolioQ.data?.solUsd;
    const sol = solUi ?? 0;
    const solPart = px != null && Number.isFinite(px) ? sol * px : 0;
    return solPart + usdcUi;
  }, [activeChain, portfolioQ.data?.solUsd, solUi, usdcUi]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if (e.key === '/' && !isEditable) {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSearchOpen]);

  function openDepositFlow() {
    setBalancePopoverOpen(false);
    setExchangeOpen(true);
  }

  return (
    <>
    <header className="sticky top-0 z-50 box-border flex min-h-[var(--app-topbar-h)] shrink-0 items-center gap-1.5 border-b border-border-subtle bg-bg-base px-2 py-1 pt-[env(safe-area-inset-top,0px)] sm:gap-2 sm:px-2.5 sm:py-1.5 relative">
      <Link
        href="/pulse"
        prefetch
        className="flex shrink-0 select-none items-center gap-2.5 pr-5 text-fg-primary sm:gap-3 sm:pr-8 md:pr-10 lg:pr-12"
      >
        <span className="sr-only">pointer.</span>
        {/* True swallow mark (transparent PNG from brand assets). */}
        <img
          src="/branding/pointer-bird.png"
          alt=""
          width={40}
          height={40}
          decoding="async"
          className="h-9 w-auto shrink-0 object-contain sm:h-10"
        />
        <span className="font-sans text-[1.35rem] font-semibold leading-none tracking-tight sm:text-[1.6rem] md:text-[1.85rem]">
          pointer.
        </span>
      </Link>

      <nav
        className="flex max-w-[36%] shrink-0 items-center gap-0.5 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] sm:max-w-[28%] sm:gap-1 md:max-w-[26%] lg:max-w-none [&::-webkit-scrollbar]:hidden"
        aria-label="Primary"
      >
        {APP_NAV.map((item) => {
          const active =
            pathname === item.href || pathname?.startsWith(item.href + '/');
          const cls = cn(
            'relative flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-1.5 text-[11px] font-medium transition-all duration-150 sm:px-2.5 sm:text-[12px] md:text-[13px]',
            item.disabled
              ? 'cursor-not-allowed text-fg-muted'
              : active
                ? 'text-fg-primary after:absolute after:bottom-0 after:left-1 after:right-1 after:h-[2px] after:rounded-full after:bg-accent-primary/90'
                : 'text-fg-secondary hover:bg-white/[0.06] hover:text-fg-primary',
          );
          const inner = (
            <>
              <span className="max-[480px]:sr-only">{item.label}</span>
              {item.badge ? (
                <span className="rounded border border-border-subtle px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-fg-muted">
                  {item.badge}
                </span>
              ) : null}
            </>
          );
          return item.disabled ? (
            <span key={item.href} className={cls} aria-disabled>
              {inner}
            </span>
          ) : (
            <Link key={item.href} href={item.href} prefetch className={cn(cls, 'focus-ring')}>
              {inner}
            </Link>
          );
        })}
      </nav>

      {/* Centered co-pilot header bar (Cluely-style). Bar always visible;
          clicking it drops down a wide sheet anchored to the bar's rect. */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 hidden w-full max-w-[min(820px,calc(100vw-280px))] -translate-x-1/2 -translate-y-1/2 justify-center sm:flex">
        <CopilotHeaderBar />
      </div>

        <div className="relative z-50 flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
        <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-1.5">
          <DisplayPopover />
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className={cn(
              'focus-ring relative hidden h-8 w-[9.25rem] shrink-0 items-center gap-1.5 rounded-md border border-transparent sm:w-44 md:flex',
              'bg-bg-hover px-2 py-1 text-left transition-[border-color,background-color,box-shadow] duration-150',
              'hover:border-white/12 hover:bg-bg-base hover:shadow-[0_0_0_1px_rgba(255,255,255,0.05)]',
              'focus-visible:border-white/18',
            )}
            aria-haspopup="dialog"
            aria-expanded={searchOpen}
            aria-label="Open search"
          >
            <Search
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                searchQuery ? 'text-accent-primary/90' : 'text-fg-muted',
              )}
            />
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-[11px]',
                searchQuery ? 'text-fg-secondary opacity-90' : 'text-fg-muted',
              )}
            >
              {searchQuery.trim() || 'Search…'}
            </span>
            <kbd className="pointer-events-none hidden shrink-0 rounded border border-border-subtle/80 bg-black/30 px-1 tabular-nums text-[9px] text-fg-muted/80 xl:inline">
              /
            </kbd>
          </button>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent bg-bg-hover text-fg-muted transition-[border-color,background-color,box-shadow,color] duration-150 hover:border-white/12 hover:bg-bg-base hover:text-fg-primary hover:shadow-[0_0_0_1px_rgba(255,255,255,0.05)] focus-visible:border-white/18 md:hidden"
            aria-label="Open search"
            aria-expanded={searchOpen}
          >
            <Search className="h-4 w-4 shrink-0" aria-hidden />
          </button>

        <ChainSelectDropdown />

        <button
          type="button"
          onClick={openDepositFlow}
          disabled={!authenticated}
          className={cn(
            'btn-press focus-ring flex h-8 items-center gap-0.5 rounded-md px-2 text-[11px] font-semibold transition-all duration-150 lg:gap-1 lg:px-2.5',
            authenticated
              ? 'bg-accent-primary text-fg-inverse hover:brightness-110'
              : 'cursor-not-allowed border border-border-subtle text-fg-muted',
          )}
        >
          <ArrowDownToLine className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
          <span className="hidden lg:inline">Deposit</span>
        </button>

        <WebPushControls />
        <CopilotToggleButton />

        {!authenticated ? (
          <button
            type="button"
            onClick={() => void login()}
            className="btn-press focus-ring flex h-8 shrink-0 items-center rounded-md bg-accent-primary px-2.5 text-[11px] font-semibold text-fg-inverse hover:brightness-110 sm:px-3"
          >
            {linkedTonAddress ? 'Finish sign-in' : 'Connect wallet'}
          </button>
        ) : null}

        {authenticated ? (
          <div className="ml-0.5 flex items-center gap-1 border-l border-border-subtle pl-1.5 sm:ml-1 sm:gap-2 sm:pl-2">
            <Link
              href="/wallets"
              className="max-w-[4.5rem] shrink-0 truncate tabular-nums text-[10px] text-fg-secondary transition-colors hover:text-fg-primary sm:hidden"
              title="Manage wallets"
              prefetch
            >
              {walletAddress ? shortenAddress(walletAddress, 3) : 'Wallets'}
            </Link>
            <div className="relative hidden min-w-0 sm:block" ref={walletMenuRef}>
              <div className="flex flex-col items-end gap-0">
                <div className="flex items-center">
                  <button
                    ref={balanceAnchorRef}
                    type="button"
                    onClick={() => {
                      setBalancePopoverOpen((o) => !o);
                      setWalletMenuOpen(false);
                    }}
                    className={cn(
                      'focus-ring rounded-l-md px-1.5 py-0.5 text-right transition-colors duration-150',
                      'hover:bg-bg-hover text-fg-primary',
                    )}
                    aria-haspopup="dialog"
                    aria-expanded={balancePopoverOpen}
                  >
                    <span className="block max-w-[7rem] truncate text-[11px] font-medium leading-tight text-fg-primary sm:max-w-[9rem]">
                      {headerNativeUi != null
                        ? `${formatNumber(headerNativeUi, { decimals: 3 })} ${nativeSym}`
                        : `0 ${nativeSym}`}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWalletMenuOpen((o) => !o);
                      setBalancePopoverOpen(false);
                    }}
                    className="focus-ring rounded-r-md px-1 py-0.5 transition-colors duration-150 hover:bg-bg-hover"
                    aria-expanded={walletMenuOpen}
                    aria-haspopup="listbox"
                    aria-label="Switch wallet"
                    title="Switch wallet"
                  >
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 text-fg-muted transition-transform duration-150',
                        walletMenuOpen && 'rotate-180',
                      )}
                    />
                  </button>
                </div>
                {walletAddress ? (
                  <span className="tabular-nums text-[10px] text-fg-muted">
                    {shortenAddress(walletAddress, 4)}
                  </span>
                ) : null}
              </div>
              {walletMenuPresence.mounted ? (
                <div
                  className={cn(
                    'absolute right-0 top-[calc(100%+4px)] z-[200] min-w-[15rem] overflow-hidden rounded-md border border-border-subtle bg-bg-raised py-1 shadow-lg',
                    popoverPanelClasses(walletMenuPresence.visible),
                  )}
                  role="listbox"
                >
                  {walletsForChain.length > 0 ? (
                  <div className="max-h-[min(40vh,240px)] overflow-y-auto">
                    {walletsForChain.map((w) => {
                      const isSel = w.wallet_address === walletAddress;
                      const canSign = canSignWithWallet(w.wallet_address);
                      const unusable = w.is_archived || !w.is_active || !canSign;
                      return (
                        <div
                          key={w.id}
                          className={cn(
                            'flex items-stretch gap-0.5 px-1',
                            isSel ? 'bg-bg-hover/80' : '',
                          )}
                        >
                          <button
                            type="button"
                            role="option"
                            aria-selected={isSel}
                            disabled={unusable && !isSel}
                            onClick={() => {
                              if (unusable && !isSel) return;
                              setActiveWalletAddress(w.wallet_address);
                              setWalletMenuOpen(false);
                            }}
                            className={cn(
                              'min-w-0 flex-1 px-1.5 py-1.5 text-left text-[11px] transition-colors duration-150',
                              unusable && !isSel
                                ? 'cursor-not-allowed text-fg-muted opacity-50'
                                : 'text-fg-secondary hover:bg-bg-hover hover:text-fg-primary',
                              isSel && 'text-fg-primary',
                            )}
                          >
                            <span className="block truncate font-medium">
                              {w.label?.trim() || shortenAddress(w.wallet_address, 4)}
                              {w.is_primary ? (
                                <span className="font-normal text-fg-muted"> · primary</span>
                              ) : null}
                            </span>
                            <span className="block tabular-nums text-[10px] text-fg-muted">
                              {shortenAddress(w.wallet_address, 4)}
                              {w.is_archived ? ' · archived' : ''}
                              {!w.is_active ? ' · inactive' : ''}
                              {!canSign ? ' · not linked' : ''}
                            </span>
                          </button>
                          <a
                            href={explorerAccountUrlForChain(w.wallet_address, activeChain)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex shrink-0 items-center px-1 text-fg-muted hover:text-fg-secondary"
                            title={`${nativeSym} explorer`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                  ) : (
                    <div className="px-2.5 py-2 text-[11px] leading-snug text-fg-muted">
                      No <span className="font-semibold text-fg-secondary">{nativeSym}</span> wallet yet for
                      this chain. Create or import one on Wallets.
                    </div>
                  )}
                  <div className="border-t border-border-subtle pt-1">
                    <Link
                      href="/wallets"
                      className="block px-2 py-1.5 text-[11px] text-accent-primary hover:bg-bg-hover"
                      onClick={() => setWalletMenuOpen(false)}
                    >
                      Manage wallets
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="relative" ref={avatarMenuRef}>
              <button
                ref={avatarButtonRef}
                type="button"
                onClick={() => {
                  setAvatarMenuOpen((o) => !o);
                  setWalletMenuOpen(false);
                  setBalancePopoverOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={avatarMenuOpen}
                aria-label="Account menu"
                className="rounded-full outline-none focus-visible:ring-1 focus-visible:ring-accent-primary/40"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-primary text-[10px] font-semibold text-fg-inverse">
                  {topbarAvatarInitials(walletAddress, user?.id)}
                </div>
              </button>
              {avatarMenuPresence.mounted ? (
                <div
                  role="menu"
                  className={cn(
                    'absolute right-0 top-[calc(100%+4px)] z-[200] w-48 overflow-hidden rounded-md border border-border-subtle bg-bg-raised text-fg-secondary shadow-lg',
                    popoverPanelClasses(avatarMenuPresence.visible),
                  )}
                >
                  <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-primary text-[10px] font-bold text-fg-inverse">
                      {topbarAvatarInitials(walletAddress, user?.id)}
                    </div>
                    {walletAddress ? (
                      <span className="truncate font-mono text-[11px] text-fg-secondary">
                        {shortenAddress(walletAddress, 4)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-fg-muted">No wallet linked</span>
                    )}
                  </div>
                  <div className="space-y-0.5 p-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAvatarMenuOpen(false);
                        setSettingsOpen(true);
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] leading-tight hover:bg-bg-hover hover:text-fg-primary"
                    >
                      <Settings className="h-3.5 w-3.5 text-fg-muted" strokeWidth={2} aria-hidden />
                      <span>Settings</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAvatarMenuOpen(false);
                        void logout();
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] leading-tight hover:bg-signal-bear/10 hover:text-signal-bear"
                    >
                      <LogOut className="h-3.5 w-3.5 text-fg-muted" strokeWidth={2} aria-hidden />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        </div>
      </div>
    </header>

    <WalletBalancePopover
      open={balancePopoverOpen}
      onOpenChange={setBalancePopoverOpen}
      anchorRef={balanceAnchorRef}
      totalUsd={totalUsd}
      solUi={solUi}
      usdcUi={usdcUi}
      onDeposit={openDepositFlow}
      hasActiveWallet={Boolean(walletAddress)}
    />
    <ExchangeModal
      open={exchangeOpen}
      onOpenChange={setExchangeOpen}
      initialTab="deposit"
      walletAddress={walletAddress}
      onOpenDepositHistory={() => setDepositHistoryOpen(true)}
    />
    <DepositHistoryModal open={depositHistoryOpen} onOpenChange={setDepositHistoryOpen} />
    <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
