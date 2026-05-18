'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import {
  ArrowDownToLine,
  ChevronDown,
  ExternalLink,
  Languages,
  LogOut,
  Rocket,
  Search,
  Settings,
  Shield,
  UserRound,
  Wallet,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { CopilotTopbarSlot } from '@/components/copilot/CopilotTopbarSlot';
import { CopilotToggleButton } from '@/components/layout/AICopilotPanel';
import { ChainSelectDropdown } from '@/components/layout/ChainSelectDropdown';
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

/**
 * App topbar: brand, primary nav, search, chain pill, deposit, co-pilot, wallet.
 * Height matches --app-topbar-h; full-width layout (no left sidebar).
 */
export function Topbar() {
  const pathname = usePathname();
  const { authenticated, logout, getAccessToken, login, linkedTonAddress } = usePointerAuth();
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
    <header className="sticky top-0 z-50 box-border flex min-h-[var(--app-topbar-h)] shrink-0 items-center gap-1.5 border-b border-border-subtle bg-bg-base px-2 py-0.5 pt-[env(safe-area-inset-top,0px)] sm:gap-2 sm:px-2.5 sm:py-1 relative">
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

      {/* Compact centered pill — tight width so it doesn’t compete with nav. */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-[65] block min-w-0 -translate-x-1/2 -translate-y-1/2">
        <div className="pointer-events-auto flex justify-center">
          <CopilotTopbarSlot />
        </div>
      </div>

        {/* flex-1 spans the middle visually; without pointer-events-none it steals clicks from the centered co-pilot pill (z-index stacking). */}
        <div className="pointer-events-none relative z-50 flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
        <div className="pointer-events-auto flex shrink-0 items-center justify-end gap-1 sm:gap-1.5">
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
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-bg-sunken/50 text-fg-muted transition-colors hover:border-border-default hover:bg-bg-hover hover:text-fg-primary sm:hidden"
              title="Manage wallets"
              prefetch
            >
              <Wallet className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            </Link>

            <div className="relative hidden min-w-0 sm:block" ref={walletMenuRef}>
              <div
                className={cn(
                  'flex h-8 w-auto max-w-[11.5rem] items-stretch rounded-md border border-border-subtle/85 bg-bg-sunken/40',
                  'shadow-[inset_0_1px_0_rgb(var(--fg-primary-rgb)/0.035)]',
                )}
              >
                <div className="flex shrink-0 items-center pl-1.5 text-fg-muted" aria-hidden>
                  <Wallet className="h-3 w-3 opacity-85" strokeWidth={2} />
                </div>

                <button
                  ref={balanceAnchorRef}
                  type="button"
                  onClick={() => {
                    setBalancePopoverOpen((o) => !o);
                    setWalletMenuOpen(false);
                  }}
                  className={cn(
                    'focus-ring flex min-w-0 flex-1 items-center px-2 py-0.5 transition-colors duration-150',
                    'rounded-none border-0 bg-transparent hover:bg-white/[0.035]',
                  )}
                  aria-haspopup="dialog"
                  aria-expanded={balancePopoverOpen}
                  title="Balances"
                >
                  <span className="min-w-0 truncate text-right tabular-nums text-[11px] font-semibold leading-none tracking-tight text-fg-primary">
                    {headerNativeUi != null
                      ? formatNumber(headerNativeUi, { decimals: 4 })
                      : '0'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setWalletMenuOpen((o) => !o);
                    setBalancePopoverOpen(false);
                  }}
                  className="focus-ring inline-flex h-full w-7 shrink-0 items-center justify-center border-l border-border-subtle/85 bg-transparent transition-colors hover:bg-white/[0.035]"
                  aria-expanded={walletMenuOpen}
                  aria-haspopup="listbox"
                  aria-label="Switch wallet"
                  title="Switch wallet"
                >
                  <ChevronDown
                    className={cn(
                      'h-3 w-3 shrink-0 text-fg-muted transition-transform duration-200 ease-out will-change-transform',
                      walletMenuOpen && 'rotate-180',
                    )}
                  />
                </button>
              </div>
              {walletMenuPresence.mounted ? (
                <div
                  className={cn(
                    'absolute right-0 top-[calc(100%+6px)] z-[200] min-w-[15rem] overflow-hidden rounded-md border border-border-subtle bg-bg-raised py-1 shadow-lg',
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
                      No <span className="font-semibold text-fg-secondary">{nativeSym}</span> wallet yet for this
                      chain. Create or import one on Wallets.
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

            <div className="relative shrink-0" ref={avatarMenuRef}>
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
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/40"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-bg-sunken/90 text-fg-muted shadow-[inset_0_1px_0_rgb(var(--fg-primary-rgb)/0.06)] ring-1 ring-border-subtle/70">
                  <UserRound className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                </span>
              </button>
              {avatarMenuPresence.mounted ? (
                <div
                  role="menu"
                  className={cn(
                    'absolute right-0 top-[calc(100%+6px)] z-[200] w-52 overflow-hidden rounded-xl border border-border-subtle bg-bg-raised py-1.5 text-fg-secondary shadow-[0_16px_40px_-12px_rgba(0,0,0,0.75)]',
                    popoverPanelClasses(avatarMenuPresence.visible),
                  )}
                >
                  <div className="border-b border-border-subtle px-3 pb-2 pt-1">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-fg-muted">Wallet</p>
                    {walletAddress ? (
                      <p className="mt-1 truncate font-mono text-[12px] text-fg-primary" title={walletAddress}>
                        {shortenAddress(walletAddress, 4)}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-fg-muted">No wallet linked</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 px-1.5 pt-1.5">
                    <Link
                      href="/wallets"
                      role="menuitem"
                      onClick={() => setAvatarMenuOpen(false)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[12px] transition-colors hover:bg-bg-hover hover:text-fg-primary"
                    >
                      <Shield className="h-4 w-4 shrink-0 text-fg-muted" strokeWidth={2} aria-hidden />
                      <span>Account & security</span>
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAvatarMenuOpen(false);
                        setSettingsOpen(true);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[12px] transition-colors hover:bg-bg-hover hover:text-fg-primary"
                    >
                      <Settings className="h-4 w-4 shrink-0 text-fg-muted" strokeWidth={2} aria-hidden />
                      <span>Settings</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => setAvatarMenuOpen(false)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[12px] text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary"
                    >
                      <Languages className="h-4 w-4 shrink-0 text-fg-muted" strokeWidth={2} aria-hidden />
                      <span>Auto translate</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => setAvatarMenuOpen(false)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[12px] transition-colors hover:bg-bg-hover hover:text-fg-primary"
                    >
                      <Rocket className="h-4 w-4 shrink-0 text-fg-muted" strokeWidth={2} aria-hidden />
                      <span>Feature updates</span>
                    </button>
                  </div>
                  <div className="border-t border-border-subtle px-1.5 pb-0.5 pt-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAvatarMenuOpen(false);
                        void logout();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[12px] text-signal-bear transition-colors hover:bg-signal-bear/10"
                    >
                      <LogOut className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
                      <span>Log out</span>
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
