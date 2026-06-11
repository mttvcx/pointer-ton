'use client';

import { useState } from 'react';
import { Bell, LayoutPanelTop, Palette } from 'lucide-react';
import { DiscordLogo } from '@/components/icons/DiscordLogo';
import { DiagnosticsTriggerButton } from '@/components/reports/BugReportDrawer';
import {
  BottomBarNotificationModal,
  BottomBarThemeModal,
} from '@/components/layout/bottomBar/BottomBarShellModals';
import { BottomBarRegionMenu } from '@/components/layout/bottomBar/BottomBarRegionMenu';
import { useConnectionStatus } from '@/lib/hooks/useConnectionStatus';
import { cn } from '@/lib/utils/cn';
import { useWatchlistStore } from '@/store/watchlist';

function RailDivider() {
  return <span className="mx-0.5 hidden h-3.5 w-px bg-border-subtle sm:block" aria-hidden />;
}

function RailIconButton({
  title,
  onClick,
  children,
  active,
}: {
  title: string;
  onClick?: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-md p-1.5 transition-colors',
        active
          ? 'bg-bg-hover text-fg-primary'
          : 'text-fg-muted hover:bg-bg-hover hover:text-fg-primary',
      )}
    >
      {children}
    </button>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function BottomBarStatusRail({
  onOpenDiagnostics,
}: {
  onOpenDiagnostics: () => void;
}) {
  const status = useConnectionStatus();
  const [themeOpen, setThemeOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const watchlistTickerOn = useWatchlistStore((s) => s.settings.showTicker);
  const setShowWatchlistTicker = useWatchlistStore((s) => s.setShowTicker);

  const statusLabel =
    status === 'stable' ? 'Stable' : status === 'degraded' ? 'Slow' : 'Offline';
  const statusColor =
    status === 'stable'
      ? 'text-signal-bull'
      : status === 'degraded'
        ? 'text-signal-warn'
        : 'text-signal-bear';
  const dotColor =
    status === 'stable' ? 'bg-signal-bull' : status === 'degraded' ? 'bg-signal-warn' : 'bg-signal-bear';

  return (
    <>
      <div className="flex h-full shrink-0 items-center gap-0.5 overflow-visible sm:gap-1">
        <span
          className={cn(
            'hidden items-center gap-1.5 px-1 text-[11px] font-medium leading-none md:inline-flex',
            statusColor,
          )}
          title={`Connection ${statusLabel.toLowerCase()}`}
        >
          <span className={cn('h-[6px] w-[6px] shrink-0 rounded-full', dotColor)} aria-hidden />
          {statusLabel}
        </span>

        <RailDivider />
        <BottomBarRegionMenu />
        <RailDivider />

        <RailIconButton
          title={watchlistTickerOn ? 'Hide watchlist ticker' : 'Show watchlist ticker'}
          active={watchlistTickerOn}
          onClick={() => setShowWatchlistTicker(!watchlistTickerOn)}
        >
          <LayoutPanelTop className="h-3.5 w-3.5" strokeWidth={2} />
        </RailIconButton>
        <RailIconButton title="Notification settings" onClick={() => setNotifOpen(true)}>
          <Bell className="h-3.5 w-3.5" strokeWidth={2} />
        </RailIconButton>
        <RailIconButton title="Customize theme" onClick={() => setThemeOpen(true)}>
          <Palette className="h-3.5 w-3.5" strokeWidth={2} />
        </RailIconButton>

        <RailDivider />

        <DiagnosticsTriggerButton
          compactMobile
          onClick={onOpenDiagnostics}
          className="!rounded-md !px-1.5 !py-1.5 !text-[11px] !font-medium !text-fg-muted hover:!bg-bg-hover hover:!text-fg-primary"
        />

        <RailDivider />

        <a
          href="https://discord.com"
          target="_blank"
          rel="noreferrer"
          title="Discord"
          className="rounded-md p-1.5 text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
        >
          <DiscordLogo className="h-3.5 w-[18px] shrink-0" />
        </a>
        <a
          href="https://x.com"
          target="_blank"
          rel="noreferrer"
          title="X"
          className="rounded-md p-1.5 text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
        >
          <XIcon className="h-3.5 w-3.5" />
        </a>
        {/* Docs link removed until real documentation exists — never point Docs at /pulse. */}
      </div>

      <BottomBarThemeModal open={themeOpen} onClose={() => setThemeOpen(false)} />
      <BottomBarNotificationModal open={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  );
}
