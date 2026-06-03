import type { SyntheticStockMarketType } from '@/lib/stocks/types';
import { cn } from '@/lib/utils/cn';

const LABEL: Record<SyntheticStockMarketType, string> = {
  pre_ipo: 'Pre-IPO',
  public_equity: 'Public Equity',
  index: 'Index',
  crypto_equity: 'Crypto Equity',
};

const TONE: Record<SyntheticStockMarketType, string> = {
  pre_ipo: 'border-violet-400/30 bg-violet-500/10 text-violet-200/90',
  public_equity: 'border-cyan-400/25 bg-cyan-500/10 text-cyan-100/90',
  index: 'border-amber-400/25 bg-amber-500/10 text-amber-100/90',
  crypto_equity: 'border-signal-bull/25 bg-signal-bull/10 text-signal-bull',
};

export function StockRiskBadge({
  marketType,
  className,
}: {
  marketType: SyntheticStockMarketType;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded-sm border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide',
        TONE[marketType],
        className,
      )}
    >
      {LABEL[marketType]}
    </span>
  );
}
