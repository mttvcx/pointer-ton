'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useAdminMe } from '@/lib/admin/useAdminApi';
import {
  Gauge,
  Languages,
  LogOut,
  Menu,
  Rocket,
  Search,
  Settings,
  Shield,
  UserRound,
  Users,
  } from 'lucide-react';
import { useMobileNavStore } from '@/store/mobileNav';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CLIPBOARD_TOPBAR_SLOT_PX,
  ClipboardMintTopbarChip,
  ClipboardMintTopbarSlot,
} from '@/components/layout/ClipboardMintTopbarChip';
import { CopilotTopbarSlot } from '@/components/copilot/CopilotTopbarSlot';
import { SandboxBadge } from '@/components/sandbox/SandboxBadge';
import { ChainSelectDropdown } from '@/components/layout/ChainSelectDropdown';
import { WebPushControls } from '@/components/layout/WebPushControls';
import { resolveTopbarNav } from '@/lib/layout/topbarNav';
import { useTopbarNavStore } from '@/store/topbarNav';
import { DisplayPopover } from '@/components/preferences/DisplayPopover';
import { WalletBalancePopover } from '@/components/wallet/WalletBalancePopover';
import type { ExchangeTab } from '@/components/wallet/ExchangeModal';

const ExchangeModal = dynamic(
  () => import('@/components/wallet/ExchangeModal').then((m) => ({ default: m.ExchangeModal })),
  { ssr: false },
);
const DepositHistoryModal = dynamic(
  () =>
    import('@/components/wallet/DepositHistoryModal').then((m) => ({
      default: m.DepositHistoryModal,
    })),
  { ssr: false },
);
const SettingsModal = dynamic(
  () => import('@/components/settings/SettingsModal').then((m) => ({ default: m.SettingsModal })),
  { ssr: false },
);
const AutoTranslateModal = dynamic(
  () =>
    import('@/components/settings/AutoTranslateModal').then((m) => ({
      default: m.AutoTranslateModal,
    })),
  { ssr: false },
);
const FeatureUpdatesModal = dynamic(
  () =>
    import('@/components/settings/FeatureUpdatesModal').then((m) => ({
      default: m.FeatureUpdatesModal,
    })),
  { ssr: false },
);
import { USDC_MINT_MAINNET } from '@/components/wallet/walletFundingConstants';
import { useUIStore } from '@/store/ui';
import { useAuthSyncStore } from '@/store/authSync';
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
import { useWalletBalancesPoll } from '@/lib/hooks/useWalletBalancesPoll';
import { useWalletNativeBalance } from '@/lib/hooks/useWalletNativeBalance';
import { fetchPortfolioJson, portfolioQueryKey } from '@/lib/portfolio/portfolioQuery';
import { toggleSquadsOnPulse, closeSquadsRail } from '@/lib/squads/openSquadsOnPulse';
import { usePulseSquadsRailStore } from '@/store/pulseSquadsRail';
import { useTokenDockPeekStore } from '@/store/tokenDockPeek';

/**
 * App topbar: brand, primary nav, search, chain pill, deposit, wallet.
 * Height matches --app-topbar-h; full-width layout (no left sidebar).
 */
export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { authenticated, loggingOut, logout, getAccessToken, login, linkedTonAddress } =
    usePointerAuth();
  const isAdmin = Boolean(useAdminMe().data);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const searchOpen = useUIStore((s) => s.searchOpen);
  const setSearchOpen = useUIStore((s) => s.setSearchOpen);
  const activeChain = useUIStore((s) => s.activeChain);
  const nativeSym = nativeTicker(activeChain);
  const chainTicker = CHAIN_TICKER[activeChain];
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [exchangeTab, setExchangeTab] = useState<ExchangeTab>('deposit');
  const [depositHistoryOpen, setDepositHistoryOpen] = useState(false);
  const [walletPopoverOpen, setWalletPopoverOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const openSettings = useUIStore((s) => s.openSettings);
  const exchangeRequestSignal = useUIStore((s) => s.exchangeRequest);
  const clearExchangeRequest = useUIStore((s) => s.clearExchangeRequest);
  const [autoTranslateOpen, setAutoTranslateOpen] = useState(false);
  const [featureUpdatesOpen, setFeatureUpdatesOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const avatarMenuPresence = useOverlayPresence(avatarMenuOpen, POPOVER_ANIM_CLOSE_MS);
  const topbarNavOrder = useTopbarNavStore((s) => s.order);
  const navItems = useMemo(() => resolveTopbarNav(topbarNavOrder), [topbarNavOrder]);
  // Admin-only nav tab (appended after the normal items, same styling). Hidden
  // for everyone else; the route itself is RBAC-gated server-side too.
  const navItemsToRender = useMemo(
    () => (isAdmin ? [...navItems, { label: 'Admin', href: '/admin' }] : navItems),
    [navItems, isAdmin],
  );
  const squadsRailSide = usePulseSquadsRailStore((s) => s.side);
  const squadsFloatOpen = useTokenDockPeekStore((s) => s.squadsPeekOpen);
  const squadsOpen = squadsRailSide !== 'hidden' || squadsFloatOpen;
  const backendReady = useAuthSyncStore((s) => s.backendReady);

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
    staleTime: 15_000,
  });

  const walletPollIds = useMemo(
    () =>
      (myWalletsQ.data?.wallets ?? [])
        .filter(
          (w) =>
            w.is_active &&
            !w.is_archived &&
            mintMatchesAppChain(w.wallet_address, activeChain),
        )
        .map((w) => w.id),
    [myWalletsQ.data?.wallets, activeChain],
  );

  const { activeAddress, ready: walletsReady } = useActiveSolanaWallet(myWalletsQ.data?.wallets);
  const walletAddress = activeAddress;

  const activeWalletRow = useMemo(
    () =>
      walletAddress
        ? myWalletsQ.data?.wallets?.find((w) => w.wallet_address === walletAddress) ?? null
        : null,
    [myWalletsQ.data?.wallets, walletAddress],
  );

  const onPortfolioPage = Boolean(pathname?.startsWith('/portfolio'));

  useWalletBalancesPoll({
    enabled: authenticated && activeChain === 'sol' && walletPollIds.length > 0,
    walletIds: walletPollIds,
    getAccessToken,
    queryClient,
    intervalMs: onPortfolioPage ? undefined : 15_000,
    priorityWalletId: activeWalletRow?.id ?? null,
  });

  const activeNativeBalQ = useWalletNativeBalance({
    enabled:
      authenticated &&
      Boolean(activeWalletRow?.id) &&
      (activeChain === 'sol' || activeChain === 'ton'),
    walletId: activeWalletRow?.id,
    fallbackLamports: activeWalletRow?.balance_lamports,
    getAccessToken,
  });
  const spendAsset = useTradingStore((s) => s.spendAsset);
  const setSpendAsset = useTradingStore((s) => s.setSpendAsset);

  useEffect(() => {
    if (!avatarMenuOpen) return;
    function onDoc(e: MouseEvent) {
      if (avatarMenuRef.current?.contains(e.target as Node)) return;
      setAvatarMenuOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [avatarMenuOpen]);

  // Other surfaces (perps "Get USDC") trigger the wallet exchange modal here.
  useEffect(() => {
    if (!exchangeRequestSignal) return;
    setExchangeTab(exchangeRequestSignal.tab);
    setExchangeOpen(true);
    clearExchangeRequest();
  }, [exchangeRequestSignal, clearExchangeRequest]);

  const needsFullPortfolio =
    Boolean(pathname?.startsWith('/portfolio')) ||
    exchangeOpen ||
    depositHistoryOpen ||
    walletPopoverOpen;

  const portfolioQ = useQuery({
    queryKey: portfolioQueryKey(walletAddress),
    queryFn: () =>
      fetchPortfolioJson<{
        solLamports: string | null;
        solUsd: number | null;
        holdings: Array<{
          mint: string;
          rawAmount: string;
          decimals: number;
          symbol: string | null;
        }>;
      }>(getAccessToken, walletAddress),
    enabled: Boolean(
      authenticated &&
        backendReady &&
        walletsReady &&
        walletAddress &&
        activeChain === 'sol' &&
        mintMatchesAppChain(walletAddress, 'sol') &&
        needsFullPortfolio,
    ),
    staleTime: 15_000,
    refetchInterval: needsFullPortfolio ? 15_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const tickersQ = useQuery({
    queryKey: ['jupiter-tickers'],
    queryFn: async (): Promise<
      Array<{ symbol: string; usdPrice: number | null; priceChange24h: number | null }>
    > => {
      const res = await fetch('/api/prices/tickers');
      const json: unknown = await res.json();
      const arr =
        json && typeof json === 'object' && 'tickers' in json
          ? (
              json as {
                tickers: Array<{
                  symbol: string;
                  usdPrice: number | null;
                  priceChange24h: number | null;
                }>;
              }
            ).tickers
          : [];
      return Array.isArray(arr) ? arr : [];
    },
    enabled: authenticated && activeChain === 'sol',
    staleTime: 25_000,
    refetchInterval: 30_000,
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

  const walletRowSolUi = useMemo(() => {
    const row = myWalletsQ.data?.wallets?.find((w) => w.wallet_address === walletAddress);
    return parseLamportsStringToSol(row?.balance_lamports ?? null);
  }, [myWalletsQ.data?.wallets, walletAddress]);

  const liveNativeUi = activeNativeBalQ.data?.ui ?? null;

  const solUi =
    liveNativeUi ??
    (portfolioQ.data?.solLamports != null
      ? parseLamportsStringToSol(portfolioQ.data.solLamports)
      : walletRowSolUi);

  const tonBalanceUi = useMemo(() => {
    if (activeChain !== 'ton' || !walletAddress) return null;
    if (liveNativeUi != null) return liveNativeUi;
    const row = myWalletsQ.data?.wallets?.find((w) => w.wallet_address === walletAddress);
    return parseLamportsStringToSol(row?.balance_lamports ?? null) ?? 0;
  }, [activeChain, walletAddress, liveNativeUi, myWalletsQ.data?.wallets]);

  const headerNativeUi = activeChain === 'sol' ? solUi : activeChain === 'ton' ? tonBalanceUi : null;

  const usdcUi = useMemo(() => {
    const h = portfolioQ.data?.holdings?.find((x) => x.mint === USDC_MINT_MAINNET);
    if (!h) return 0;
    return rawToUi(h.rawAmount, h.decimals);
  }, [portfolioQ.data?.holdings]);

  const solUsdEstimate = useMemo(() => {
    if (portfolioQ.data?.solUsd != null && Number.isFinite(portfolioQ.data.solUsd)) {
      return portfolioQ.data.solUsd;
    }
    const solTicker = tickersQ.data?.find((t) => t.symbol === 'SOL');
    const px = solTicker?.usdPrice;
    return px != null && Number.isFinite(px) ? px : null;
  }, [portfolioQ.data?.solUsd, tickersQ.data]);

  const totalUsd = useMemo(() => {
    if (activeChain !== 'sol') return null;
    const sol = solUi ?? 0;
    const solPart =
      solUsdEstimate != null && Number.isFinite(solUsdEstimate) ? sol * solUsdEstimate : 0;
    return solPart + usdcUi;
  }, [activeChain, solUsdEstimate, solUi, usdcUi]);

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
    <header
      className={cn(
        'sticky top-0 isolate box-border grid min-h-[var(--app-topbar-h)] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-1.5 border-b border-white/[0.06] bg-bg-base px-2 py-0.5 pt-[env(safe-area-inset-top,0px)] sm:gap-2 sm:px-2.5 sm:py-1',
        // While the account menu is open, lift the whole header stacking context
        // above the floating docks (z-221) so its scrim can dim them too.
        avatarMenuOpen ? 'z-[300]' : 'z-[100]',
      )}
    >
      {/* Left — logo + primary nav (above center chrome so Championship / $PTR stay clickable) */}
      <div className="relative z-20 flex min-w-0 items-center gap-1 sm:gap-1.5">
      <Link
        href="/pulse"
        prefetch={true}
        onClick={() => {
          closeSquadsRail();
        }}
        className="flex shrink-0 select-none items-center gap-2 pr-2 text-fg-primary sm:gap-2.5 sm:pr-3"
      >
        <span className="sr-only">pointer.</span>
        {/* True swallow mark (transparent PNG from brand assets). */}
        <img
          src="/branding/pointer-bird.png"
          alt=""
          width={40}
          height={40}
          decoding="async"
          fetchPriority="high"
          className="h-9 w-auto shrink-0 object-contain sm:h-10"
        />
        <span className="font-sans text-[1.35rem] font-semibold leading-none tracking-tight sm:text-[1.6rem] md:text-[1.85rem]">
          pointer.
        </span>
      </Link>

      <nav
        className="hidden max-w-[38%] shrink-0 items-center gap-0.5 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] sm:max-w-[32%] sm:gap-1 md:max-w-[30%] lg:flex lg:max-w-none [&::-webkit-scrollbar]:hidden"
        aria-label="Primary"
      >
        {navItemsToRender.map((item) => {
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
      </div>

      {/* Center — AI copilot slot; hidden on mobile (no AI below lg). */}
      <div className="pointer-events-none hidden min-w-0 items-center justify-center px-0.5 lg:flex">
        <div className="hidden items-center sm:flex">
          <div
            className="pointer-events-none shrink-0"
            style={{ width: CLIPBOARD_TOPBAR_SLOT_PX }}
            aria-hidden
          />
          <div className="pointer-events-auto">
            <CopilotTopbarSlot />
          </div>
          <ClipboardMintTopbarSlot />
        </div>
        <div className="pointer-events-auto flex min-w-0 items-center gap-1.5 sm:hidden">
          <CopilotTopbarSlot />
          <ClipboardMintTopbarChip />
        </div>
      </div>

      {/* Right — search, chain, squads, wallet */}
      <div className="relative z-20 flex min-w-0 items-center justify-end gap-1 sm:gap-1.5">
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

        <SandboxBadge variant="topbar" />

        <ChainSelectDropdown />

        {!authenticated && !loggingOut ? (
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
            'group/squads relative ml-0.5 hidden shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/20 sm:ml-1 lg:block',
            squadsOpen && 'ring-2 ring-white/25',
          )}
        >
          <span
            className={cn(
              'relative flex h-8 w-8 items-center justify-center rounded-full bg-[#2a2a2d] text-white/85',
              'transition-colors group-hover/squads:bg-[#333338] group-hover/squads:text-white',
              squadsOpen && 'bg-[#333338] text-white',
            )}
          >
            <Users className="h-[16px] w-[16px]" strokeWidth={2.1} aria-hidden />
            <span
              className="absolute -bottom-px -right-px h-2 w-2 rounded-full border border-[#1a1a1e] bg-signal-bull"
              aria-hidden
            />
          </span>
        </button>

        {authenticated ? (
          <div className="ml-0.5 flex items-center gap-1.5 sm:ml-1 sm:gap-2">
            <WalletBalancePopover
              onOpenChange={setWalletPopoverOpen}
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
            />

            <div className="relative hidden shrink-0 lg:block" ref={avatarMenuRef}>
              <button
                ref={avatarButtonRef}
                type="button"
                onClick={() => setAvatarMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={avatarMenuOpen}
                aria-label="Account menu"
                title="Account"
                className="group/avatar rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2a2a2d] text-[#b0b0b4]',
                    'transition-colors group-hover/avatar:bg-[#333338] group-hover/avatar:text-white',
                    avatarMenuOpen && 'bg-[#333338] text-white',
                  )}
                >
                  <UserRound className="h-[17px] w-[17px]" strokeWidth={2} aria-hidden />
                </span>
              </button>
              {avatarMenuPresence.mounted ? (
                <>
                  {/* Scrim: fade everything (incl. docks) so the menu is the one
                      focused thing and never gets covered by a floating dock. */}
                  <button
                    type="button"
                    aria-label="Close account menu"
                    onClick={() => setAvatarMenuOpen(false)}
                    className={cn(
                      'fixed inset-0 z-[290] cursor-default bg-black/45 backdrop-blur-[2px] transition-opacity duration-200',
                      avatarMenuPresence.visible ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                <div
                  role="menu"
                  className={cn(
                    'absolute right-0 top-[calc(100%+8px)] z-[300] w-52 overflow-hidden rounded-xl border border-[#2e2e32] bg-[#1a1a1e] py-1.5 text-[#c4c4c8] shadow-[0_12px_40px_rgba(0,0,0,0.55)]',
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
                    {isAdmin ? (
                      <Link
                        href="/admin"
                        role="menuitem"
                        prefetch={false}
                        onClick={() => setAvatarMenuOpen(false)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[12px] font-semibold text-accent-primary transition-colors hover:bg-accent-primary/10"
                      >
                        <Gauge className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                        <span>Pointer Ops</span>
                      </Link>
                    ) : null}
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
                      onClick={() => {
                        setAvatarMenuOpen(false);
                        setFeatureUpdatesOpen(true);
                      }}
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
                        // `logout()` clears local session + sets the logging-out
                        // flag synchronously before its first await, so kicking it
                        // off and navigating immediately drops the app shell (and
                        // the "Connect wallet" button) right away — the slow Privy /
                        // TonConnect teardown then finishes in the background.
                        void logout();
                        router.replace('/');
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[12px] font-semibold text-signal-bear transition-colors hover:bg-signal-bear/10"
                    >
                      <LogOut className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Mobile ☰ — opens the drawer (desktop uses the avatar menu + nav). */}
        <button
          type="button"
          onClick={() => useMobileNavStore.getState().setDrawerOpen(true)}
          aria-label="Open menu"
          className="focus-ring ml-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary lg:hidden"
        >
          <Menu className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>
      </div>
    </header>

    {exchangeOpen ? (
      <ExchangeModal
        open={exchangeOpen}
        onOpenChange={setExchangeOpen}
        initialTab={exchangeTab}
        walletAddress={walletAddress}
        nativeBalance={headerNativeUi}
        usdcBalance={usdcUi}
        solUsd={portfolioQ.data?.solUsd ?? solUsdEstimate}
        onOpenDepositHistory={() => setDepositHistoryOpen(true)}
      />
    ) : null}
    {depositHistoryOpen ? (
      <DepositHistoryModal open={depositHistoryOpen} onOpenChange={setDepositHistoryOpen} />
    ) : null}
    <SettingsModal />
    {autoTranslateOpen ? (
      <AutoTranslateModal open={autoTranslateOpen} onClose={() => setAutoTranslateOpen(false)} />
    ) : null}
    {featureUpdatesOpen ? (
      <FeatureUpdatesModal open={featureUpdatesOpen} onClose={() => setFeatureUpdatesOpen(false)} />
    ) : null}
    </>
  );
}
