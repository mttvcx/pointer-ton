'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Share2,
} from 'lucide-react';
import { CloseButton } from '@/components/ui/CloseButton';
import {
  aggregateDayActivity,
  dayHasActivity,
  dayHoverLabel,
  formatCalendarPnl,
  formatCalendarSideTotal,
  formatCalendarTotal,
  mondayFirstWeekdayIndex,
  monthLabel,
  safeStreakDays,
  summarizeMonthPnl,
  monthTradeVolumes,
  type CalendarCurrency,
  type CalendarTradeInput,
  type ClosedSellPnlInput,
  type DayActivity,
} from '@/lib/portfolio/dailyPnlCalendar';
import { formatNumber, formatSol } from '@/lib/utils/formatters';
import { ChainIcon } from '@/components/squads/ChainIcon';
import { PointerBirdMark } from '@/components/branding/PointerBirdMark';
import { cn } from '@/lib/utils/cn';
import { useUIStore } from '@/store/ui';
import { useOverlayPresence } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
import { Z_APP_MODAL_OVERLAY } from '@/lib/ui/zLayers';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  loadCalendarCurrency,
  saveCalendarCurrency,
} from '@/lib/portfolio/pnlCalendarPrefs';
import { useWalletIntelStore } from '@/store/walletIntelStore';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

function CalendarAmount({
  amount,
  currency,
  iconSize = 12,
  className,
}: {
  amount: string;
  currency: CalendarCurrency;
  iconSize?: number;
  iconClassName?: string;
  className?: string;
}) {
  const activeChain = useUIStore((s) => s.activeChain);
  const text = amount.replace(/^\+/, '');
  if (currency === 'usd') {
    return <span className={cn('font-sans tabular-nums', className)}>{text}</span>;
  }
  return (
    <span className={cn('inline-flex items-center gap-1 font-sans tabular-nums', className)}>
      <ChainIcon chain={activeChain} size={iconSize} className="shrink-0 rounded-full" />
      <span>{text}</span>
    </span>
  );
}

function guardStreak(value: number): number {
  if (isNaN(value) || !isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

function totalPnlClass(total: number): string {
  if (total > 0) return 'text-[#00c27a]';
  if (total < 0) return 'text-red-400';
  return 'text-white';
}

function dayTradeCount(activity: DayActivity): number {
  return activity.buys + activity.sells;
}

function cellBackground(activity: DayActivity): string {
  const pnl = activity.pnlUsd;
  if (pnl > 0) return 'bg-[#00c27a]/[0.10]';
  if (pnl < 0) return 'bg-red-500/[0.10]';
  return 'bg-white/[0.03]';
}

function cellPnlTextClass(activity: DayActivity, currency: CalendarCurrency): string {
  const pnl = activity.pnlUsd;
  if (pnl > 0) return 'text-[#00c27a]';
  if (pnl < 0) return currency === 'sol' ? 'text-[#ff8fa8]' : 'text-red-400';
  if (currency === 'sol') return 'text-white/35';
  return 'text-white/25';
}

function shouldShowDayPnl(activity: DayActivity, currency: CalendarCurrency): boolean {
  if (currency === 'sol') return true;
  return activity.pnlUsd !== 0 || dayTradeCount(activity) > 0;
}

function DayDetailPanel({
  year,
  month,
  day,
  activity,
  currency,
  solUsd,
}: {
  year: number;
  month: number;
  day: number;
  activity: DayActivity;
  currency: CalendarCurrency;
  solUsd: number | null;
}) {
  const rate = solUsd != null && solUsd > 0 ? solUsd : 150;
  const hasTrades = dayTradeCount(activity) > 0 || dayHasActivity(activity);

  const fmtVol = (sol: number) => {
    if (sol === 0) return currency === 'usd' ? '$0' : '0';
    if (currency === 'usd') {
      const usd = sol * rate;
      return `$${formatNumber(usd, { decimals: usd >= 10 ? 2 : 3 })}`;
    }
    return formatSol(sol);
  };

  return (
    <div className="w-[200px]">
      <p className="mb-2 text-[11.5px] font-medium text-white/60">
        {dayHoverLabel(year, month, day)}
      </p>
      {!hasTrades ? (
        <p className="text-[11px] text-white/40">No closed trades for this day</p>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex flex-col items-center gap-0.5 rounded-lg bg-white/[0.06] p-2">
            <div className="flex items-center gap-0.5 text-[#00c27a]">
              <ArrowDown className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              <span className="text-[13px] font-medium tabular-nums">{activity.buys}</span>
            </div>
            <span className="text-[9px] uppercase text-white/40">Buys</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 rounded-lg bg-white/[0.06] p-2">
            <div className="flex items-center gap-0.5 text-red-400">
              <ArrowUp className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              <span className="text-[13px] font-medium tabular-nums">{activity.sells}</span>
            </div>
            <span className="text-[9px] uppercase text-white/40">Sells</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 rounded-lg bg-white/[0.06] p-2">
            <div className="flex items-center gap-0.5 text-[#00c27a]">
              <ArrowUp className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              {currency === 'sol' ? (
                <span className="inline-flex items-center gap-1 text-[13px] font-medium font-sans tabular-nums">
                  <ChainIcon chain="solana" size={14} className="shrink-0 rounded-full" />
                  {fmtVol(activity.buyVolSol)}
                </span>
              ) : (
                <span className="text-[13px] font-medium font-sans tabular-nums">{fmtVol(activity.buyVolSol)}</span>
              )}
            </div>
            <span className="text-[9px] uppercase text-white/40">Buy Vol.</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 rounded-lg bg-white/[0.06] p-2">
            <div className="flex items-center gap-0.5 text-red-400">
              <ArrowDown className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              {currency === 'sol' ? (
                <span className="inline-flex items-center gap-1 text-[13px] font-medium font-sans tabular-nums">
                  <ChainIcon chain="solana" size={14} className="shrink-0 rounded-full" />
                  {fmtVol(activity.sellVolSol)}
                </span>
              ) : (
                <span className="text-[13px] font-medium font-sans tabular-nums">{fmtVol(activity.sellVolSol)}</span>
              )}
            </div>
            <span className="text-[9px] uppercase text-white/40">Sell Vol.</span>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarDayCell({
  dayKey,
  year,
  month,
  day,
  activity,
  currency,
  solUsd,
  isToday,
  selected,
  onSelect,
}: {
  dayKey: string;
  year: number;
  month: number;
  day: number;
  activity: DayActivity;
  currency: CalendarCurrency;
  solUsd: number | null;
  isToday: boolean;
  selected: boolean;
  onSelect: (key: string) => void;
}) {
  const showPnl = shouldShowDayPnl(activity, currency);
  const pnlLabel = formatCalendarPnl(activity, currency, solUsd);

  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onSelect(dayKey)}
          className={cn(
            'relative flex h-[68px] w-full flex-col rounded-lg p-2',
            'cursor-pointer transition-all hover:brightness-110',
            cellBackground(activity),
            isToday && 'ring-1 ring-white/[0.15]',
            selected && !isToday && 'ring-1 ring-white/35',
          )}
        >
          <span className="text-left text-[10px] font-sans tabular-nums text-white/25">{day}</span>
          <div className="mt-auto text-left pt-1">
            {showPnl ? (
              currency === 'sol' ? (
                <CalendarAmount
                  amount={pnlLabel}
                  currency="sol"
                  iconSize={12}
                  className={cn('text-[11px] font-semibold leading-none', cellPnlTextClass(activity, currency))}
                />
              ) : (
                <span
                  className={cn(
                    'text-[11px] font-semibold font-sans tabular-nums leading-none',
                    cellPnlTextClass(activity, currency),
                  )}
                >
                  {pnlLabel.replace(/^\+/, '')}
                </span>
              )
            ) : null}
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className={cn(
          'z-[300] w-auto max-w-none border-white/[0.08] bg-[#0e0e10] p-3 shadow-2xl',
          'rounded-xl text-fg-primary',
        )}
      >
        <DayDetailPanel
          year={year}
          month={month}
          day={day}
          activity={activity}
          currency={currency}
          solUsd={solUsd}
        />
      </TooltipContent>
    </Tooltip>
  );
}

export function PnlCalendarModal({
  open,
  onClose,
  closedSells,
  trades,
  solUsd,
  usdMode = true,
}: {
  open: boolean;
  onClose: () => void;
  closedSells: ClosedSellPnlInput[];
  trades: CalendarTradeInput[];
  solUsd: number | null;
  usdMode?: boolean;
}) {
  const now = useMemo(() => new Date(), [open]);
  const [viewYear, setViewYear] = useState(now.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(now.getUTCMonth());
  const [currency, setCurrency] = useState<CalendarCurrency>(usdMode ? 'usd' : 'sol');
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const currencyRef = useRef<HTMLDivElement>(null);
  const openMonthlyShare = useWalletIntelStore((s) => s.openMonthlyShare);

  useEffect(() => {
    if (!open) return;
    const d = new Date();
    setViewYear(d.getUTCFullYear());
    setViewMonth(d.getUTCMonth());
    setCurrency(loadCalendarCurrency(usdMode ? 'usd' : 'sol'));
    setCurrencyOpen(false);
    setSelectedDayKey(null);
  }, [open, usdMode]);

  useEffect(() => {
    setSelectedDayKey(null);
  }, [viewYear, viewMonth]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!currencyOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (currencyRef.current?.contains(e.target as Node)) return;
      setCurrencyOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [currencyOpen]);

  const daily = useMemo(
    () => aggregateDayActivity(closedSells, trades, solUsd),
    [closedSells, trades, solUsd],
  );

  const summary = useMemo(
    () => summarizeMonthPnl(daily, viewYear, viewMonth, solUsd, now),
    [daily, viewYear, viewMonth, solUsd, now],
  );

  const { mounted, visible } = useOverlayPresence(open);

  if (!mounted) return null;

  const leadingBlanks = mondayFirstWeekdayIndex(viewYear, viewMonth);
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
  const monthShort = monthLabel(viewYear, viewMonth).split(' ')[0] ?? 'Month';

  const winShare =
    currency === 'usd' ? Math.abs(summary.winTotalUsd) : Math.abs(summary.winTotalSol);
  const lossShare =
    currency === 'usd' ? Math.abs(summary.lossTotalUsd) : Math.abs(summary.lossTotalSol);
  const barTotal = winShare + lossShare;
  const winPct = barTotal > 0 ? (winShare / barTotal) * 100 : 50;

  const totalDisplay = currency === 'usd' ? summary.totalPnlUsd : summary.totalPnlSol;
  const currentStreak = guardStreak(safeStreakDays(summary.currentPositiveStreak));
  const bestStreak = guardStreak(safeStreakDays(summary.bestPositiveStreak));

  const winAmount = formatCalendarSideTotal(summary.winTotalUsd, summary.winTotalSol, currency);
  const lossAmount = formatCalendarSideTotal(summary.lossTotalUsd, summary.lossTotalSol, currency);

  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  const canGoNextMonth =
    viewYear < currentYear || (viewYear === currentYear && viewMonth < currentMonth);

  function shiftMonth(delta: number) {
    const d = new Date(Date.UTC(viewYear, viewMonth + delta, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    if (y > currentYear || (y === currentYear && m > currentMonth)) return;
    setViewYear(y);
    setViewMonth(m);
  }

  function onShareMonthly() {
    const volumes = monthTradeVolumes(daily, viewYear, viewMonth);
    openMonthlyShare({
      year: viewYear,
      month: viewMonth,
      currency,
      summary,
      solUsd,
      buyVolSol: volumes.buyVolSol,
      sellVolSol: volumes.sellVolSol,
    });
    onClose();
  }

  const dialog = (
    <TooltipProvider delayDuration={100} skipDelayDuration={0}>
      <div className={cn('fixed inset-0 flex items-center justify-center p-4', Z_APP_MODAL_OVERLAY)}>
        <button
          type="button"
          className={cn(
            'absolute inset-0 cursor-default bg-black/70 backdrop-blur-[3px]',
            overlayBackdropClasses(visible),
            visible ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          aria-label="Dismiss"
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="PNL Calendar"
          className={cn(
            'relative z-10 flex w-[660px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/[0.06]',
            'bg-[#0c0c0e] shadow-2xl shadow-black/70',
            overlayPanelClasses(visible),
            visible ? 'opacity-100 scale-100' : 'pointer-events-none opacity-0',
          )}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-white/[0.04] px-4 pb-3 pt-3.5">
            <h2 className="text-[14px] font-medium text-white">PNL Calendar</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="flex items-center justify-center text-white/40 transition hover:text-white/80"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="w-[76px] text-center text-[13px] font-medium tabular-nums text-white/80">
                {monthLabel(viewYear, viewMonth)}
              </span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                disabled={!canGoNextMonth}
                className={cn(
                  'flex items-center justify-center transition',
                  canGoNextMonth
                    ? 'text-white/40 hover:text-white/80'
                    : 'cursor-not-allowed text-white/15',
                )}
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <div ref={currencyRef} className="relative">
                <button
                  type="button"
                  onClick={() => setCurrencyOpen((v) => !v)}
                  className="flex items-center gap-1 rounded-full bg-white/[0.06] px-3 py-1 text-[12px] uppercase text-white/80 transition hover:bg-white/[0.09]"
                  aria-expanded={currencyOpen}
                  aria-haspopup="listbox"
                >
                  <span className="inline-flex flex-col leading-none text-white/35" aria-hidden>
                    <ChevronRight className="h-2 w-2 -rotate-90" />
                    <ChevronRight className="h-2 w-2 rotate-90" />
                  </span>
                  {currency}
                </button>
                {currencyOpen ? (
                  <div
                    role="listbox"
                    className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[5.5rem] overflow-hidden rounded-lg border border-white/[0.08] bg-[#121316] py-1 shadow-xl animate-in fade-in duration-150"
                  >
                    {(['usd', 'sol'] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="option"
                        aria-selected={currency === c}
                        onClick={() => {
                          setCurrency(c);
                          saveCalendarCurrency(c);
                          setCurrencyOpen(false);
                        }}
                        className={cn(
                          'flex w-full px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wide transition hover:bg-white/[0.06]',
                          currency === c ? 'text-white' : 'text-white/50',
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onShareMonthly}
                title="Share Monthly PNL"
                className="flex h-7 w-7 items-center justify-center rounded-full text-white/50 transition hover:bg-white/[0.06] hover:text-white/80"
                aria-label="Share Monthly PNL"
              >
                <Share2 className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <CloseButton onClick={onClose} label="Close" size="md" />
            </div>
          </div>

          {/* Body — no internal scroll; Axiom-style wide compact layout */}
          <div>
            <div className="px-4 py-2.5">
              <CalendarAmount
                amount={formatCalendarTotal(summary, currency)}
                currency={currency}
                iconSize={16}
                className={cn('text-[22px] font-semibold leading-none', totalPnlClass(totalDisplay))}
              />
              <div className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                <div
                  className="absolute inset-y-0 left-0 bg-[#00c27a] transition-all duration-300 ease-out"
                  style={{ width: `${winPct}%` }}
                />
                <div
                  className="absolute inset-y-0 right-0 bg-red-400 transition-all duration-300 ease-out"
                  style={{ width: `${100 - winPct}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11.5px]">
                <span className="inline-flex items-center gap-1 tabular-nums text-[#00c27a]">
                  <span>{summary.winDays}</span>
                  <span className="text-white/25">/</span>
                  <CalendarAmount amount={winAmount} currency={currency} iconSize={12} />
                </span>
                <span className="inline-flex items-center gap-1 tabular-nums text-red-400">
                  <span>{summary.lossDays}</span>
                  <span className="text-white/25">/</span>
                  <CalendarAmount amount={lossAmount} currency={currency} iconSize={12} />
                </span>
              </div>
            </div>

            <div className="px-3 pb-3">
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((d, i) => (
                  <div
                    key={`${d}-${i}`}
                    className="py-1 text-center text-[10px] font-normal uppercase tracking-wider text-white/25"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: leadingBlanks }, (_, i) => (
                  <div key={`blank-${i}`} className="h-[68px] w-full bg-transparent" aria-hidden />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const activity = daily.get(key) ?? {
                    pnlUsd: 0,
                    pnlSol: 0,
                    buys: 0,
                    sells: 0,
                    buyVolSol: 0,
                    sellVolSol: 0,
                  };
                  const isToday =
                    now.getUTCFullYear() === viewYear &&
                    now.getUTCMonth() === viewMonth &&
                    now.getUTCDate() === day;
                  return (
                    <CalendarDayCell
                      key={key}
                      dayKey={key}
                      year={viewYear}
                      month={viewMonth}
                      day={day}
                      activity={activity}
                      currency={currency}
                      solUsd={solUsd}
                      isToday={isToday}
                      selected={selectedDayKey === key}
                      onSelect={setSelectedDayKey}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/[0.04] px-4 py-2.5">
            <p className="min-w-0 text-[11px] text-white/50">
              Current Positive Streak:{' '}
              <span className="font-semibold text-white">{currentStreak}</span> days
              <span className="mx-1.5 text-white/25">·</span>
              Best in {monthShort}:{' '}
              <span className="font-semibold text-white">{bestStreak}</span> days
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              <PointerBirdMark size={18} className="opacity-95" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/35">
                POINTER
              </span>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(dialog, document.body);
}
