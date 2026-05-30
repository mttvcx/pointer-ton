'use client';

import { useEffect, useState } from 'react';
import { DockPulseFloatingPanel } from '@/components/layout/DockPulseFloatingPanel';
import { DockWalletTrackerFloatingPanel } from '@/components/layout/DockWalletTrackerFloatingPanel';
import { DockXMonitorFloatingPanel } from '@/components/layout/DockXMonitorFloatingPanel';
import { DockSquadsFloatingPanel } from '@/components/layout/DockSquadsFloatingPanel';
import { PnlTrackerFloatingWidget } from '@/components/pnl/PnlTrackerFloatingWidget';
import { PnlCalendarHost } from '@/components/portfolio/PnlCalendarHost';
import { WalletAnalyticsHost } from '@/components/wallet/analytics/WalletAnalyticsHost';
import { SquadsTraderProfileHost } from '@/components/squads/SquadsTraderProfileHost';
import { AutoBuyExecutor } from '@/components/auto-buy/AutoBuyExecutor';
import { AutoLaunchExecutor } from '@/components/auto-launch/AutoLaunchExecutor';
import { AutoSellExecutor } from '@/components/auto-sell/AutoSellExecutor';
import { AutoBuyToastHost } from '@/components/auto-buy/AutoBuyToastHost';
import { AutoSellToastHost } from '@/components/auto-sell/AutoSellToastHost';
import { AlertRuleAudioPlayer } from '@/components/alerts/AlertRuleAudioPlayer';
import { ClientBugDiagnosticsBootstrap } from '@/components/reports/ClientBugDiagnosticsBootstrap';
import { FirstTimeSpotlightOnboarding } from '@/components/onboarding/FirstTimeSpotlightOnboarding';
import { FeatureAnnouncementGate } from '@/components/onboarding/FeatureAnnouncementGate';

/** Heavy hosts — mounted after first paint so Topbar/logo/chain icons win the network. */
export function DeferredAppShellHosts() {
  return (
    <>
      <WalletAnalyticsHost />
      <SquadsTraderProfileHost />
      <AlertRuleAudioPlayer />
      <AutoBuyExecutor />
      <AutoLaunchExecutor />
      <AutoBuyToastHost />
      <AutoSellExecutor />
      <AutoSellToastHost />
      <DockPulseFloatingPanel />
      <DockWalletTrackerFloatingPanel />
      <DockXMonitorFloatingPanel />
      <DockSquadsFloatingPanel />
      <PnlTrackerFloatingWidget />
      <PnlCalendarHost />
      <ClientBugDiagnosticsBootstrap />
      <FirstTimeSpotlightOnboarding />
      <FeatureAnnouncementGate />
    </>
  );
}

/** Mount deferred shell after idle — keeps initial route interactive. */
export function DeferredAppShellGate() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const run = () => setReady(true);
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 2_500 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(run, 300);
    return () => window.clearTimeout(t);
  }, []);

  if (!ready) return null;
  return <DeferredAppShellHosts />;
}
