'use client';

import type { CSSProperties } from 'react';
import { CalendarPanel } from '@/components/wallet/analytics/pnl-share/CalendarPanel';
import { FooterBranding } from '@/components/wallet/analytics/pnl-share/FooterBranding';
import { MetallicText } from '@/components/wallet/analytics/pnl-share/MetallicText';
import { PointerBirdMark, PointerWordmark } from '@/components/wallet/analytics/pnl-share/PointerLogoLockup';
import { PnLValueBox } from '@/components/wallet/analytics/pnl-share/PnLValueBox';
import { StatRow } from '@/components/wallet/analytics/pnl-share/StatRow';
import type { PointerPnLShareCardData } from '@/lib/share/pnlShareCardData';
import { PNL_SHARE_POS, pnlShareContentOffset } from '@/lib/share/pnlShareLayout';
import { cn } from '@/lib/utils/cn';

export type { PointerPnLShareCardData };

export function PointerPnLShareCard({
  data,
  scale = 1,
  textScale = 1,
  calendarMonthLabel,
  statBoughtLabel = 'Total Bought',
  statSoldLabel = 'Total Sold',
  motionBasis,
  motionFrozen,
  motionRevealKey,
  className,
}: {
  data: PointerPnLShareCardData;
  scale?: number;
  textScale?: number;
  calendarMonthLabel?: string | null;
  statBoughtLabel?: string;
  statSoldLabel?: string;
  motionBasis?: import('@/components/wallet/analytics/PnlMomentAmount').PnlMomentBasis | null;
  motionFrozen?: boolean;
  motionRevealKey?: string;
  className?: string;
}) {
  const s = scale * textScale;
  const theme = data.themeVariant;
  const accent = data.accent;
  const pos = PNL_SHARE_POS;
  const colX = pnlShareContentOffset(data.overlayAlign) * scale;

  const heroFontSize = Math.round(pos.heroAmount.fontSize * s);
  const periodFontSize = Math.round(pos.periodHeadline.fontSize * s);
  const showPctStat = data.pnlFormat !== 'amount' && data.pnlPercent;
  const showHeroToken = data.pnlFormat !== 'pct';

  return (
    <div className={cn('relative h-full w-full overflow-visible', className)}>
      <PointerBirdMark
        className="absolute z-10"
        style={{ left: pos.logo.x * scale, top: pos.logo.y * scale }}
      />
      <div
        className="absolute z-10"
        style={{
          right: pos.wordmark.right * scale,
          top: pos.wordmark.y * scale,
          maxWidth: 320 * scale,
        }}
      >
        <PointerWordmark
          theme={theme}
          accent={accent}
          style={{ fontSize: Math.round(pos.wordmark.fontSize * s) }}
        />
      </div>

      <MetallicText
        variant="title"
        theme={theme}
        accent={accent}
        as="h1"
        className="absolute z-[1] font-black uppercase tracking-tight"
        style={{
          left: colX,
          top: pos.periodHeadline.y * scale,
          fontSize: periodFontSize,
          lineHeight: pos.periodHeadline.lineHeight,
          maxWidth: pos.heroBox.w * scale,
        }}
      >
        {data.periodLabel}
      </MetallicText>

      <div
        className="absolute z-[2]"
        style={{
          left: colX,
          top: pos.heroBox.y * scale,
          width: pos.heroBox.w * scale,
        }}
      >
        <PnLValueBox
          amount={data.pnlAmount}
          token={data.pnlToken}
          positive={data.positive}
          theme={theme}
          accent={accent}
          fontSize={heroFontSize}
          showToken={showHeroToken}
          motionBasis={data.pnlFormat === 'pct' ? null : motionBasis}
          motionFrozen={motionFrozen}
          motionRevealKey={motionRevealKey}
        />
      </div>

      <div
        className="absolute z-[1] flex flex-col overflow-visible"
        style={{
          left: colX,
          top: pos.stats.y * scale,
          width: 720 * scale,
          gap: pos.stats.rowGap * scale,
        }}
      >
        {showPctStat ? (
          <StatRow label="PNL" value={data.pnlPercent!} theme={theme} accent={accent} />
        ) : null}
        <StatRow label={statBoughtLabel} value={data.totalBought} theme={theme} accent={accent} />
        <StatRow label={statSoldLabel} value={data.totalSold} theme={theme} accent={accent} />
        {data.walletAddressLine ? (
          <StatRow label="Wallet" value={data.walletAddressLine} theme={theme} accent={accent} />
        ) : null}
      </div>

      <FooterBranding
        username={data.username}
        theme={theme}
        accent={accent}
        scale={scale}
        className="absolute z-[1]"
        style={{
          left: colX,
          top: pos.footerLogo.y * scale,
        } satisfies CSSProperties}
      />

      {data.showCalendar ? (
        <div
          className="absolute z-[1]"
          style={{
            left: pos.calendar.x * scale,
            top: pos.calendar.y * scale,
            width: pos.calendar.w * scale,
          }}
        >
          <CalendarPanel
            days={data.calendarDays}
            monthLabel={calendarMonthLabel}
            theme={theme}
            accent={accent}
          />
        </div>
      ) : null}
    </div>
  );
}
