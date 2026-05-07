'use client';

import { useEffect, type ReactNode } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { Layers, Loader2 } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { GlobalSearchModal } from '@/components/layout/GlobalSearchModal';
import { LabelWalletModal } from '@/components/wallets/LabelWalletModal';
import { WalletLabelsBootstrap } from '@/components/wallets/WalletLabelsBootstrap';
import { AlertRuleFlashLayer } from '@/components/alerts/AlertRuleFlashLayer';
import { AlertRuleAudioPlayer } from '@/components/alerts/AlertRuleAudioPlayer';
import { AICopilotPanel } from '@/components/layout/AICopilotPanel';
import { BottomBar } from '@/components/layout/BottomBar';
import { FeatureAnnouncementGate } from '@/components/onboarding/FeatureAnnouncementGate';
import { FirstTimeSpotlightOnboarding } from '@/components/onboarding/FirstTimeSpotlightOnboarding';
import { useAuthSync } from '@/lib/hooks/useAuthSync';
import { useUIStore } from '@/store/ui';
import { APP_NAME, APP_TAGLINE } from '@/lib/utils/constants';

/**
 * Auth-gated shell: [Topbar] [main + AI co-pilot] with fixed bottom bar.
 * Main scrolls above the 44px bottom chrome; content column uses the viewport
 * between 48px top and 44px bottom.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { ready, authenticated, login } = usePointerAuth();
  useAuthSync();

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

  if (!authenticated) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-bg-base px-6">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(124,92,255,0.18),transparent_60%)]" />

        <div className="w-full max-w-sm border border-border-subtle p-7">
          <div className="mb-5 flex items-center gap-2">
            <Layers className="h-4 w-4 text-accent-primary" strokeWidth={2.25} />
            <span className="text-sm font-semibold tracking-tight text-fg-primary">
              {APP_NAME}
            </span>
          </div>

          <h1 className="text-lg font-semibold text-fg-primary">Sign in to continue</h1>
          <p className="mt-1 text-xs text-fg-secondary">{APP_TAGLINE}</p>

          <button
            type="button"
            onClick={() => void login()}
            className="mt-5 w-full rounded-sm bg-accent-primary py-2 text-sm font-medium text-fg-inverse transition-all duration-150 hover:bg-accent-glow"
          >
            Continue with TonConnect
          </button>

          <p className="mt-3 text-center tabular-nums text-[10px] text-fg-muted">
            TON wallet (Tonkeeper, MyTonWallet, etc.)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-bg-base text-fg-primary">
      <Topbar />
      <GlobalSearchModal />
      <WalletLabelsBootstrap />
      <LabelWalletModal />
      <AlertRuleFlashLayer />
      <AlertRuleAudioPlayer />
      <div className="flex min-h-0 flex-1">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-[var(--app-bottombar-h)]">
          {children}
        </main>
        <AICopilotPanel />
      </div>
      <BottomBar />
      <FirstTimeSpotlightOnboarding />
      <FeatureAnnouncementGate />
    </div>
  );
}
