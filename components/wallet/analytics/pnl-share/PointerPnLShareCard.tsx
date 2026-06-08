'use client';

import type { CSSProperties } from 'react';
import { CalendarPanel } from '@/components/wallet/analytics/pnl-share/CalendarPanel';
import { FooterBranding } from '@/components/wallet/analytics/pnl-share/FooterBranding';
import { MetallicText } from '@/components/wallet/analytics/pnl-share/MetallicText';
import { PointerLogoLockup } from '@/components/wallet/analytics/pnl-share/PointerLogoLockup';
import { PnLValueBox } from '@/components/wallet/analytics/pnl-share/PnLValueBox';
import { StatRow } from '@/components/wallet/analytics/pnl-share/StatRow';
import type { PointerPnLShareCardData } from '@/lib/share/pnlShareCardData';
import { PNL_SHARE_POS } from '@/lib/share/pnlShareLayout';
import { cn } from '@/lib/utils/cn';

export type { PointerPnLShareCardData };

export function PointerPnLShareCard({
  data,
  scale = 1,
  textScale = 1,
  calendarMonthLabel,
  statBoughtLabel = 'Total Bought',
  statSoldLabel = 'Total Sold',
  showCashbackFooter = true,
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
  showCashbackFooter?: boolean;
  motionBasis?: import('@/components/wallet/analytics/PnlMomentAmount').PnlMomentBasis | null;
  motionFrozen?: boolean;
  motionRevealKey?: string;
  className?: string;
}) {
  const s = scale * textScale;
  const theme = data.themeVariant;
  const pos = PNL_SHARE_POS;

  const heroFontSize = Math.round(pos.heroAmount.fontSize * s);
  const periodFontSize = Math.round(pos.periodHeadline.fontSize * s);

  return (
    <div className={cn('relative h-full w-full', className)}>
      {/* Top bar */}
      <div
        className="absolute flex items-start justify-between"
        style={{
          left: pos.logo.x * scale,
          right: pos.username.right * scale,
          top: pos.logo.y * scale,
        }}
      >
        {data.showLogo ? <PointerLogoLockup theme={theme} size="md" /> : <span />}
        <div className="flex flex-col items-end text-right">
          <MetallicText
            variant="username"
            theme={theme}
            className="text-[15px] font-medium leading-none opacity-80"
          >
            x
          </MetallicText>
          <MetallicText
            variant="username"
            theme={theme}
            className="mt-1 max-w-[420px] truncate text-[34px] font-semibold leading-tight"
            style={{ fontSize: Math.round(34 * s) }}
          >
            {data.username}
          </MetallicText>
        </div>
      </div>

      {/* Period headline */}
      <MetallicText
        variant="title"
        theme={theme}
        as="h1"
        className="absolute font-black uppercase leading-none tracking-tight"
        style={{
          left: pos.periodHeadline.x * scale,
          top: pos.periodHeadline.y * scale,
          fontSize: periodFontSize,
          maxWidth: (pos.heroBox.w + 120) * scale,
        }}
      >
        {data.periodLabel}
      </MetallicText>

      {/* Hero PnL box */}
      <div
        className="absolute"
        style={{
          left: pos.heroBox.x * scale,
          top: pos.heroBox.y * scale,
          width: pos.heroBox.w * scale,
        }}
      >
        <PnLValueBox
          amount={data.pnlAmount}
          token={data.pnlToken}
          positive={data.positive}
          theme={theme}
          fontSize={heroFontSize}
          motionBasis={motionBasis}
          motionFrozen={motionFrozen}
          motionRevealKey={motionRevealKey}
        />
      </div>

      {/* Stats */}
      <div
        className="absolute flex flex-col"
        style={{
          left: pos.stats.x * scale,
          top: pos.stats.y * scale,
          width: 520 * scale,
          gap: pos.stats.rowGap * scale,
        }}
      >
        {data.pnlPercent ? (
          <StatRow label="PNL" value={data.pnlPercent} theme={theme} className="[&_span:last-child]:text-[26px]" />
        ) : null}
        <StatRow
          label={statBoughtLabel}
          value={data.totalBought}
          theme={theme}
          className="[&_span:last-child]:text-[22px]"
        />
        <StatRow
          label={statSoldLabel}
          value={data.totalSold}
          theme={theme}
          className="[&_span:last-child]:text-[22px]"
        />
      </div>

      {/* Calendar */}
      {data.showCalendar ? (
        <div
          className="absolute"
          style={{
            left: pos.calendar.x * scale,
            top: pos.calendar.y * scale,
            width: pos.calendar.w * scale,
          }}
        >
          <CalendarPanel days={data.calendarDays} monthLabel={calendarMonthLabel} theme={theme} />
        </div>
      ) : null}

      {/* Footer */}
      {data.showFooterBranding ? (
        <FooterBranding
          username={data.username}
          theme={theme}
          showCashbackLine={showCashbackFooter}
          className="absolute"
          style={{
            left: pos.footerHandle.x * scale,
            top: pos.footerHandle.y * scale,
          } satisfies CSSProperties}
        />
      ) : null}
    </div>
  );
}
