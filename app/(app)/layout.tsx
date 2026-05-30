'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { Loader2 } from 'lucide-react';
import { ClientNavigateBridge } from '@/components/navigation/ClientNavigateBridge';
import { RoutePrefetcher } from '@/components/layout/RoutePrefetcher';
import { ProtocolLogoPreloader } from '@/components/tokens/ProtocolLogoPreloader';
import { Topbar } from '@/components/layout/Topbar';
import { WatchlistTickerBar } from '@/components/layout/WatchlistTickerBar';
import { GlobalSearchModal } from '@/components/layout/GlobalSearchModal';
import { LabelWalletModal } from '@/components/wallets/LabelWalletModal';
import { WalletLabelsBootstrap } from '@/components/wallets/WalletLabelsBootstrap';
import { LaunchModal } from '@/components/launch/LaunchModal';
import { AlertRuleFlashLayer } from '@/components/alerts/AlertRuleFlashLayer';
import { AICopilotPanel } from '@/components/layout/AICopilotPanel';
import { BottomBar } from '@/components/layout/BottomBar';
import { DeferredAppShellGate } from '@/components/layout/DeferredAppShellHosts';
import { useAuthSync } from '@/lib/hooks/useAuthSync';
import { useUIStore } from '@/store/ui';
import { APP_NAME } from '@/lib/utils/constants';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CopilotModeProvider } from '@/components/copilot/CopilotModeContext';
import { CopilotStripSlot } from '@/components/copilot/CopilotStripSlot';

function ShellCopilotSlot({ side }: { side: 'left' | 'right' }) {
  const rail = useUIStore((s) => s.copilotRailSide);
  if (rail !== side) return null;
  return <AICopilotPanel />;
}

/**
 * App shell: signed-in users (Privy and/or legacy TonConnect session). Landing stays on `/`.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { ready, authenticated, login, linkedTonAddress } = usePointerAuth();
  useAuthSync();

  const onSharePage = Boolean(pathname?.startsWith('/share/'));
  const guestBrowse =
    Boolean(pathname?.startsWith('/pulse')) ||
    Boolean(pathname?.startsWith('/explore')) ||
    Boolean(pathname?.startsWith('/token/'));

  useEffect(() => {
    document.title = APP_NAME;
  }, []);

  /** Drop legacy alert popouts — X monitor float + Pulse rail stay user-controlled. */
  useEffect(() => {
    const ui = useUIStore.getState();
    ui.setAlertRulesPopout(null);
    ui.setAlertRulesDocked(false);
    ui.setAlertRulesModalOpen(false);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        const t = e.target as HTMLElement | null;
        if (
          t?.tagName === 'INPUT' ||
          t?.tagName === 'TEXTAREA' ||
          t?.isContentEditable
        ) {
          return;
        }
        useUIStore.getState().clearLocked({ onlyManual: true });
        return;
      }
      if (e.key === ']' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const t = e.target as HTMLElement | null;
        if (
          t?.tagName === 'INPUT' ||
          t?.tagName === 'TEXTAREA' ||
          t?.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        const { panelOpen, panelCollapsed, setPanelOpen, setPanelCollapsed } = useUIStore.getState();
        if (!panelOpen) {
          setPanelOpen(true);
          return;
        }
        if (panelCollapsed) {
          setPanelCollapsed(false);
          return;
        }
        setPanelCollapsed(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-base text-fg-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!authenticated && !onSharePage && !guestBrowse) {
    return (
      <div className="flex min-h-screen flex-col bg-bg-base text-fg-primary">
        <header
          className="flex min-h-[var(--app-topbar-h)] items-center justify-between border-b px-4"
          style={{ borderColor: '#1b1f2a', backgroundColor: '#080d14' }}
        >
          <span className="text-[15px] font-semibold text-white">pointer.</span>
          <button
            type="button"
            onClick={() => void login()}
            className="btn-press rounded-md bg-[#5865F2] px-3 py-1.5 text-[12px] font-semibold text-white hover:brightness-110"
          >
            {linkedTonAddress ? 'Finish sign-in' : 'Connect wallet'}
          </button>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <h1 className="text-lg font-semibold text-white">Sign in to Pointer</h1>
          <p className="mt-2 max-w-md text-sm text-fg-secondary">
            Sign in with Privy (email, Google, X, or wallet). Then link your TON wallet via TonConnect for
            on-chain actions and trading.
          </p>
          <button
            type="button"
            onClick={() => void login()}
            className="btn-press mt-6 rounded-md bg-accent-primary px-5 py-2.5 text-sm font-semibold text-fg-inverse hover:bg-accent-glow"
          >
            {linkedTonAddress ? 'Finish TON link' : 'Sign in'}
          </button>
        </main>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <CopilotModeProvider>
      <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-bg-base text-fg-primary">
      <RoutePrefetcher />
      <ClientNavigateBridge />
      <ProtocolLogoPreloader />
      <Topbar />
      <WatchlistTickerBar />
      {/* Task S: Level 2 co-pilot body — full-width strip under topbar; Mode
          toggles height (embedded vs collapsed). */}
      <CopilotStripSlot />
      <GlobalSearchModal />
      <WalletLabelsBootstrap />
      <LabelWalletModal />
      <LaunchModal />
      <AlertRuleFlashLayer />
      <div className="flex min-h-0 flex-1">
        <ShellCopilotSlot side="left" />
        <main
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg-raised pb-[var(--app-bottombar-h)] pl-[max(var(--pulse-dock-pad-left,0px),var(--wallet-dock-pad-left,0px),var(--x-monitor-dock-pad-left,0px),var(--squads-dock-pad-left,0px))] pr-[max(var(--pulse-dock-pad-right,0px),var(--wallet-dock-pad-right,0px),var(--x-monitor-dock-pad-right,0px),var(--squads-dock-pad-right,0px))] transition-[padding] duration-200 ease-out"
        >
          {children}
        </main>
        <ShellCopilotSlot side="right" />
      </div>
      <BottomBar />
      <DeferredAppShellGate />
      </div>
      </CopilotModeProvider>
    </TooltipProvider>
  );
}
