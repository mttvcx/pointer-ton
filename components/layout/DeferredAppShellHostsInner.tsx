'use client';

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
import { CustomFontBootstrap } from '@/components/layout/bottomBar/CustomFontBootstrap';
import { FirstTimeSpotlightOnboarding } from '@/components/onboarding/FirstTimeSpotlightOnboarding';
import { FeatureAnnouncementGate } from '@/components/onboarding/FeatureAnnouncementGate';

/** Heavy hosts — separate chunk from app layout so route transitions stay fast. */
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
      <CustomFontBootstrap />
      <FirstTimeSpotlightOnboarding />
      <FeatureAnnouncementGate />
    </>
  );
}
