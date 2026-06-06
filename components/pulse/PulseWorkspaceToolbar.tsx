'use client';

import { useState } from 'react';
import { BookmarkX } from 'lucide-react';
import { PulseDisplayPopover } from '@/components/pulse/PulseDisplayPopover';
import { usePulseDisplayPrefsStore } from '@/store/pulseDisplayPrefs';
import { PulseAutolaunchPopover } from '@/components/pulse/PulseAutolaunchPopover';
import { PulseBlacklistModal } from '@/components/pulse/PulseBlacklistModal';
import { PulseHelpPopover } from '@/components/pulse/PulseHelpPopover';
import { PulseHiddenMenu } from '@/components/pulse/PulseHiddenMenu';
import { PulseWorkspaceWalletChip } from '@/components/pulse/PulseWorkspaceWalletChip';
import { pulseIconBtnCls } from '@/components/pulse/pulseToolbarStyles';
import { cn } from '@/lib/utils/cn';

/**
 * Pulse workspace top-right toolbar — Axiom / Terminal pattern:
 * Help, Display, Hidden, Blacklist, Autolaunch, Wallet pill.
 *
 * `stacked` (used when a panel is docked on the right and squeezes horizontal
 * room) lifts Help + Display onto a top row above the rest, reclaiming the
 * empty band and uncramping the controls.
 */
export function PulseWorkspaceToolbar({
  className,
  stacked = false,
}: {
  className?: string;
  stacked?: boolean;
}) {
  const [blacklistOpen, setBlacklistOpen] = useState(false);
  const showWallet = usePulseDisplayPrefsStore((s) => s.walletGroupsInHeader);

  const primary = (
    <>
      <PulseHelpPopover />
      <PulseDisplayPopover />
    </>
  );

  const secondary = (
    <>
      <PulseHiddenMenu />
      <button
        type="button"
        onClick={() => setBlacklistOpen(true)}
        title="Blacklists"
        className={pulseIconBtnCls}
        aria-label="Blacklists"
      >
        <BookmarkX className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>
      <PulseAutolaunchPopover />
      {showWallet ? <PulseWorkspaceWalletChip /> : null}
    </>
  );

  return (
    <>
      {stacked ? (
        <div className={cn('flex flex-col items-end gap-1', className)}>
          <div className="flex items-center gap-1.5">{primary}</div>
          <div className="flex items-center gap-1.5">{secondary}</div>
        </div>
      ) : (
        <div className={cn('flex items-center gap-1.5', className)}>
          {primary}
          {secondary}
        </div>
      )}

      <PulseBlacklistModal open={blacklistOpen} onClose={() => setBlacklistOpen(false)} />
    </>
  );
}
