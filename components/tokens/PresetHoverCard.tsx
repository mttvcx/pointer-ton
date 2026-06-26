'use client';

import type { ReactNode } from 'react';
import { Coins, Gauge, Shield, ShieldOff, Zap, type LucideIcon } from 'lucide-react';
import {
  HoverCard,
  HoverCardBridge,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { formatSolFromLamports } from '@/lib/utils/formatters';
import type { TradingPreset } from '@/lib/hooks/useTradingPresets';
import { cn } from '@/lib/utils/cn';

const MEV_LABEL: Record<string, string> = { off: 'Off', reduced: 'Fast', secure: 'Secure' };

function Row({ icon: Icon, value, label, accent }: { icon: LucideIcon; value: string; label: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2 py-[3px]">
      <Icon className={cn('h-3.5 w-3.5 shrink-0', accent ? 'text-accent-primary' : 'text-fg-muted')} strokeWidth={2} aria-hidden />
      <span className="num text-[12px] font-medium tabular-nums text-fg-primary">{value}</span>
      <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-fg-muted">{label}</span>
    </div>
  );
}

/**
 * Hover card for a Pulse-column quick-buy preset (P1/P2/P3). Shows that
 * preset's trade config — slippage, priority fee, bribe/tip, and MEV mode — on
 * hover, anchored to the preset button. Read-only summary; editing still lives
 * in the trade settings popover.
 */
export function PresetHoverCard({
  slot,
  preset,
  children,
}: {
  slot: number;
  preset?: TradingPreset;
  children: ReactNode;
}) {
  return (
    <HoverCard openDelay={90} closeDelay={60}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="bottom" align="center" sideOffset={6}>
        <HoverCardBridge side="bottom">
          <div className="w-[9.5rem] rounded-lg border border-white/[0.1] bg-bg-raised px-2.5 py-2 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.85)]">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
              P{slot}
              {preset?.name ? <span className="ml-1 normal-case text-fg-secondary">· {preset.name}</span> : null}
            </div>
            {preset ? (
              <>
                <Row icon={Zap} value={`${preset.slippage_bps / 100}%`} label="Slippage" accent />
                <Row icon={Gauge} value={formatSolFromLamports(preset.priority_fee_lamports)} label="Priority" />
                <Row icon={Coins} value={formatSolFromLamports(preset.jito_tip_lamports)} label="Bribe" />
                <Row
                  icon={preset.mev_mode === 'off' ? ShieldOff : Shield}
                  value={MEV_LABEL[preset.mev_mode] ?? preset.mev_mode}
                  label="MEV"
                />
              </>
            ) : (
              <p className="py-1 text-[11px] leading-snug text-fg-muted">Sign in to configure presets.</p>
            )}
          </div>
        </HoverCardBridge>
      </HoverCardContent>
    </HoverCard>
  );
}
