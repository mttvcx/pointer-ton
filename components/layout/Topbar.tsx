'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import {
  Languages,
  LogOut,
  Rocket,
  Search,
  Settings,
  Shield,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardMintTopbarChip } from '@/components/layout/ClipboardMintTopbarChip';
import { CopilotTopbarSlot } from '@/components/copilot/CopilotTopbarSlot';
import { CopilotToggleButton } from '@/components/layout/AICopilotPanel';
import { ChainSelectDropdown } from '@/components/layout/ChainSelectDropdown';
import { WebPushControls } from '@/components/layout/WebPushControls';
import { APP_NAV } from '@/components/layout/navConfig';
import { DepositHistoryModal } from '@/components/wallet/DepositHistoryModal';
import { ExchangeModal } from '@/components/wallet/ExchangeModal';
import { AutoTranslateModal } from '@/components/settings/AutoTranslateModal';
import { FeatureUpdatesModal } from '@/components/settings/FeatureUpdatesModal';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { DisplayPopover } from '@/components/preferences/DisplayPopover';
import { WalletBalancePopover } from '@/components/wallet/WalletBalancePopover';
import type { ExchangeTab } from '@/components/wallet/ExchangeModal';
import { USDC_MINT_MAINNET } from '@/components/wallet/walletFundingConstants';
import { useUIStore } from '@/store/ui';
import { useTradingStore } from '@/store/trading';
import { shortenAddress } from '@/lib/utils/addresses';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { useActiveSolanaWallet } from '@/lib/hooks/useActiveSolanaWallet';
import { cn } from '@/lib/utils/cn';
import { CHAIN_TICKER } from '@/lib/chains/chainAssets';
import { mintMatchesAppChain } from '@/lib/chains/mintKind';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { formatNumber, parseLamportsStringToSol, rawToUi } from '@/lib/utils/formatters';
import { useOverlayPresence, POPOVER_ANIM_CLOSE_MS } from '@/lib/hooks/useOverlayPresence';
import { popoverPanelClasses } from '@/lib/ui/overlayMotion';
import { usePortfolioRefreshListener } from '@/lib/hooks/usePortfolioRefreshListener';
import { toggleSquadsOnPulse } from '@/lib/squads/openSquadsOnPulse';
import { usePulseSquadsRailStore } from '@/store/pulseSquadsRail';

/**
 * App topbar: brand, primary nav, search, chain pill, deposit, co-pilot, wallet.
 * Height matches --app-topbar-h; full-width layout (no left sidebar).
 */
export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { authenticated, logout, getAccessToken, login, linkedTonAddress } = usePointerAuth();
  const searchQuery = useUIStore((s) => s.searchQuery);
  const searchOpen = useUIStore((s) => s.searchOpen);
  const setSearchOpen = useUIStore((s) => s.setSearchOpen);
  const activeChain = useUIStore((s) => s.activeChain);
  const nativeSym = nativeTicker(activeChain);
  const chainTicker = CHAIN_TICKER[activeChain];
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [exchangeTab, setExchangeTab] = useState<ExchangeTab>('deposit');
  const [depositHistoryOpen, setDepositHistoryOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const openSettings = useUIStore((s) => s.openSettings);
  const [autoTranslateOpen, setAutoTranslateOpen] = useState(false);
  const [featureUpdatesOpen, setFeatureUpdatesOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const avatarMenuPresence = useOverlayPresence(avatarMenuOpen, POPOVER_ANIM_CLOSE_MS);
  const squadsOpen = usePulseSquadsRailStore((s) => s.side !== 'hidden');

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

  const { activeAddress, ready: walletsReady } = useActiveSolanaWallet(myWalletsQ.data?.wallets);
  const walletAddress = activeAddress;
  const { spendAsset, setSpendAsset } = useTradingStore();

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
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const refreshPortfolio = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['portfolio'] });
  }, [queryClient]);

  usePortfolioRefreshListener(
    refreshPortfolio,
    Boolean(
      authenticated &&
        walletsReady &&
        walletAddress &&
        activeChain === 'sol' &&
        mintMatchesAppChain(walletAddress, 'sol'),
    ),
  );

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
    setExchangeTab('deposit');
    setExchangeOpen(true);
  }

  function openWithdrawFlow() {
    setExchangeTab('withdraw');
    setExchangeOpen(true);
  }

  return (
    <>
    <header className="sticky top-0 z-50 box-border flex min-h-[var(--app-topbar-h)] shrink-0 items-center gap-1.5 border-b border-white/[0.06] bg-bg-base px-2 py-0.5 pt-[env(safe-area-inset-top,0px)] sm:gap-2 sm:px-2.5 sm:py-1 relative">
      <Link
        href="/pulse"
        prefetch={true}
        className="flex shrink-0 select-none items-center gap-2 pr-3 text-fg-primary sm:gap-2.5 sm:pr-4 md:pr-5 lg:pr-6"
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
        className="flex max-w-[38%] shrink-0 items-center gap-0.5 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] sm:max-w-[32%] sm:gap-1 md:max-w-[30%] lg:max-w-none [&::-webkit-scrollbar]:hidden"
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
            <Link key={item.href} href={item.href} prefetch={true} className={cn(cls, 'focus-ring')}>
              {inner}
            </Link>
          );
        })}
      </nav>

      {/* Viewport-centered cluster: co-pilot pill + compact clipboard token chip (offset right of center). */}
      <div className="pointer-events-none absolute left-[calc(50%-18px)] top-1/2 z-[65] block min-w-0 -translate-x-1/2 -translate-y-1/2 sm:left-[calc(50%-22px)]">
        <div className="pointer-events-auto flex items-center justify-center gap-2">
          <CopilotTopbarSlot />
          <ClipboardMintTopbarChip />
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

        <button
          type="button"
          onClick={() => toggleSquadsOnPulse()}
          aria-label={squadsOpen ? 'Hide squads panel' : 'Open squads panel'}
          title={squadsOpen ? 'Hide squads' : 'Open squads'}
          className={cn(
            'group/squads relative ml-0.5 shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-violet-400/45 sm:ml-1',
            squadsOpen && 'ring-2 ring-violet-400/35',
          )}
        >
          <span
            className={cn(
              'relative flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white',
              'bg-gradient-to-br from-emerald-500 to-sky-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]',
              'transition-[filter,transform] group-hover/squads:brightness-110',
            )}
          >
            <Users className="h-[17px] w-[17px]" strokeWidth={2.15} aria-hidden />
            <span
              className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border border-bg-base bg-emerald-400"
              aria-hidden
            />
          </span>
        </button>

        {authenticated ? (
          <div className="ml-0.5 flex items-center gap-1 border-l border-border-subtle pl-1.5 sm:ml-1 sm:gap-2 sm:pl-2">
            <Link
              href="/wallets"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-bg-sunken/50 text-fg-muted transition-colors hover:border-border-default hover:bg-bg-hover hover:text-fg-primary sm:hidden"
              title="Manage wallets"
              prefetch={true}
            >
              <Wallet className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            </Link>

            <WalletBalancePopover
              totalUsd={totalUsd}
              nativeBalance={headerNativeUi}
              walletAddress={walletAddress}
              balances={
                activeChain === 'sol'
                  ? [
                      { symbol: chainTicker, amount: solUi, chainId: 'sol' },
                      {
                        symbol: 'USDC',
                        amount: usdcUi,
                        iconSrc: '/logos/protocols/usdc.png',
                        chainId: 'sol',
                      },
                    ]
                  : undefined
              }
              spendAsset={spendAsset}
              onSpendAssetChange={setSpendAsset}
              showSpendAssetTabs={activeChain === 'sol'}
              onDeposit={openDepositFlow}
              onWithdraw={openWithdrawFlow}
              hasActiveWallet={Boolean(walletAddress)}
              className="hidden sm:flex"
            />

            <div className="relative shrink-0" ref={avatarMenuRef}>
              <button
                ref={avatarButtonRef}
                type="button"
                onClick={() => setAvatarMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={avatarMenuOpen}
                aria-label="Account menu — settings, wallets, sign out"
                title="Account · Sign out"
                className="group/avatar rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/40"
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-accent-primary',
                    'border border-accent-primary/35 bg-accent-primary/[0.07] shadow-[inset_0_1px_0_rgb(var(--fg-primary-rgb)/0.08)]',
                    'transition-colors group-hover/avatar:border-accent-primary/55 group-hover/avatar:bg-accent-primary/[0.13]',
                    avatarMenuOpen && 'border-accent-primary/65 bg-accent-primary/[0.15]',
                  )}
                >
                  <UserRound className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
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
                      href="/portfolio?tab=wallets"
                      role="menuitem"
                      prefetch={true}
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
                        openSettings('general');
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[12px] transition-colors hover:bg-bg-hover hover:text-fg-primary"
                    >
                      <Settings className="h-4 w-4 shrink-0 text-fg-muted" strokeWidth={2} aria-hidden />
                      <span>Settings</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAvatarMenuOpen(false);
                        setAutoTranslateOpen(true);
                      }}
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
                        void (async () => {
                          try {
                            await logout();
                          } finally {
                            queryClient.clear();
                            router.replace('/');
                          }
                        })();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[12px] font-semibold text-signal-bear transition-colors hover:bg-signal-bear/10"
                    >
                      <LogOut className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
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

    <ExchangeModal
      open={exchangeOpen}
      onOpenChange={setExchangeOpen}
      initialTab={exchangeTab}
      walletAddress={walletAddress}
      nativeBalance={headerNativeUi}
      onOpenDepositHistory={() => setDepositHistoryOpen(true)}
    />
    <DepositHistoryModal open={depositHistoryOpen} onOpenChange={setDepositHistoryOpen} />
    <SettingsModal />
    <AutoTranslateModal open={autoTranslateOpen} onClose={() => setAutoTranslateOpen(false)} />
    <FeatureUpdatesModal open={featureUpdatesOpen} onClose={() => setFeatureUpdatesOpen(false)} />
    </>
  );
}
