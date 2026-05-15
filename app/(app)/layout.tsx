'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { Loader2 } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { GlobalSearchModal } from '@/components/layout/GlobalSearchModal';
import { LabelWalletModal } from '@/components/wallets/LabelWalletModal';
import { WalletAnalyticsHost } from '@/components/wallet/analytics/WalletAnalyticsHost';
import { SquadsTraderProfileHost } from '@/components/squads/SquadsTraderProfileHost';
import { WalletLabelsBootstrap } from '@/components/wallets/WalletLabelsBootstrap';
import { AlertRuleFlashLayer } from '@/components/alerts/AlertRuleFlashLayer';
import { AlertRulesDockPanel } from '@/components/alerts/AlertRulesDockPanel';
import { AlertRulesPopoutHost } from '@/components/alerts/AlertRulesPopoutHost';
import { AlertRuleAudioPlayer } from '@/components/alerts/AlertRuleAudioPlayer';
import { AICopilotPanel } from '@/components/layout/AICopilotPanel';
import { BottomBar } from '@/components/layout/BottomBar';
import { ClientBugDiagnosticsBootstrap } from '@/components/reports/ClientBugDiagnosticsBootstrap';
import { FeatureAnnouncementGate } from '@/components/onboarding/FeatureAnnouncementGate';
import { FirstTimeSpotlightOnboarding } from '@/components/onboarding/FirstTimeSpotlightOnboarding';
import { useAuthSync } from '@/lib/hooks/useAuthSync';
import { useUIStore } from '@/store/ui';
import { APP_NAME } from '@/lib/utils/constants';
import { TooltipProvider } from '@/components/ui/tooltip';

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

  useEffect(() => {
    document.title = APP_NAME;
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

  if (!authenticated && !onSharePage) {
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
      <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-bg-base text-fg-primary">
      <Topbar />
      <GlobalSearchModal />
      <WalletAnalyticsHost />
      <SquadsTraderProfileHost />
      <WalletLabelsBootstrap />
      <LabelWalletModal />
      <AlertRuleFlashLayer />
      <AlertRuleAudioPlayer />
      <div className="flex min-h-0 flex-1">
        <AlertRulesDockPanel />
        <ShellCopilotSlot side="left" />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-[var(--app-bottombar-h)]">
          {children}
        </main>
        <ShellCopilotSlot side="right" />
      </div>
      <AlertRulesPopoutHost />
      <BottomBar />
      <ClientBugDiagnosticsBootstrap />
      <FirstTimeSpotlightOnboarding />
      <FeatureAnnouncementGate />
      </div>
    </TooltipProvider>
  );
}
