'use client';

import type { ReactNode } from 'react';
import { Bell, Bot, Hand, Rocket, Sparkles, Zap } from 'lucide-react';
import { AUTO_BUY_DEMO_MINT, dispatchAutoBuyEvent } from '@/lib/alerts/autoBuyDispatch';
import { cn } from '@/lib/utils/cn';
import { useAutoBuyStore } from '@/store/autoBuy';
import { useAutoLaunchStore } from '@/store/autoLaunch';

const UI = {
  border: 'rgba(255, 255, 255, 0.1)',
  elevated: 'rgba(255, 255, 255, 0.07)',
  muted: '#9ba3b0',
  text: '#f0f4fc',
} as const;

export type TwitterRuleExecution = 'notify' | 'auto_buy' | 'auto_launch';

function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-0.5 flex items-baseline justify-between gap-2">
      <span className="text-[10px] font-medium" style={{ color: UI.muted }}>
        {children}
      </span>
      {hint ? (
        <span className="max-w-[52%] truncate text-right text-[9px]" style={{ color: UI.muted }}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function GlassCard({
  children,
  className,
  accent,
}: {
  children: ReactNode;
  className?: string;
  accent?: 'emerald' | 'violet';
}) {
  const ring =
    accent === 'emerald'
      ? 'border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.08] to-transparent'
      : accent === 'violet'
        ? 'border-violet-400/25 bg-gradient-to-br from-violet-500/[0.1] to-transparent'
        : 'border-white/[0.08] bg-white/[0.02]';
  return <div className={cn('rounded-xl border p-2.5', ring, className)}>{children}</div>;
}

function ToggleSwitch({
  on,
  onChange,
  accent = 'emerald',
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  accent?: 'emerald' | 'violet';
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors',
        on
          ? accent === 'violet'
            ? 'bg-violet-500/85'
            : 'bg-emerald-500/85'
          : 'bg-white/10',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
          on ? 'left-[18px]' : 'left-0.5',
        )}
      />
    </button>
  );
}

function MiniNumber({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
      className="w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-2 py-1.5 text-right text-[12px] tabular-nums text-[#f0f4fc] outline-none focus:border-white/20"
    />
  );
}

function ActionTab({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-center transition',
        active
          ? 'bg-white/[0.11] text-[#f0f4fc] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]'
          : 'text-fg-muted hover:bg-white/[0.04]',
      )}
    >
      <span className={cn('opacity-80', active && 'text-[#34d5ff]')}>{icon}</span>
      <span className="text-[10px] font-semibold leading-tight">{children}</span>
    </button>
  );
}

function ModeChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[10px] font-semibold transition',
        active
          ? 'bg-white/[0.11] text-[#f0f4fc] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]'
          : 'text-fg-muted hover:bg-white/[0.04]',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function AutoBuyEngineCard({
  buySol,
  onBuySolChange,
  inputCls,
}: {
  buySol: string;
  onBuySolChange: (v: string) => void;
  inputCls: string;
}) {
  const enabled = useAutoBuyStore((s) => s.autoBuyEnabled);
  const defaultSol = useAutoBuyStore((s) => s.defaultAutoBuySol);
  const dailyCap = useAutoBuyStore((s) => s.autoBuyDailyCapSol);
  const cooldownSec = useAutoBuyStore((s) => s.autoBuyCooldownSec);
  const setPrefs = useAutoBuyStore((s) => s.setPrefs);
  const daily = useAutoBuyStore((s) => s.daily);
  const stats = useAutoBuyStore.getState().getTodayStats();
  void daily;
  const capPct =
    dailyCap > 0 ? Math.min(100, Math.round((stats.spentSol / dailyCap) * 100)) : 0;

  return (
    <GlassCard accent="emerald" className="space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
            <Zap className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-[#f0f4fc]">Auto-buyer</p>
            <p className="text-[9px] leading-snug" style={{ color: UI.muted }}>
              Instant buy when a mint resolves — no confirmation
            </p>
          </div>
        </div>
        <ToggleSwitch on={enabled} onChange={(v) => setPrefs({ autoBuyEnabled: v })} />
      </div>

      {!enabled ? (
        <p className="rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-2 py-1.5 text-[10px] text-amber-200/90">
          Flip the switch to arm auto-buy for this rule.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel hint="Rule override">SOL / buy</FieldLabel>
          <input
            value={buySol}
            onChange={(e) => onBuySolChange(e.target.value)}
            inputMode="decimal"
            placeholder={String(defaultSol)}
            className={cn(inputCls, 'tabular-nums')}
            style={{ borderColor: UI.border, backgroundColor: UI.elevated, color: UI.text }}
          />
        </div>
        <div>
          <FieldLabel hint="Fallback">Default SOL</FieldLabel>
          <MiniNumber
            value={defaultSol}
            onChange={(n) => setPrefs({ defaultAutoBuySol: n })}
            min={0.01}
            max={100}
            step={0.01}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel>Daily cap</FieldLabel>
          <MiniNumber
            value={dailyCap}
            onChange={(n) => setPrefs({ autoBuyDailyCapSol: n })}
            min={0.1}
            max={1000}
            step={0.1}
          />
        </div>
        <div>
          <FieldLabel>Cooldown (s)</FieldLabel>
          <MiniNumber
            value={cooldownSec}
            onChange={(n) => setPrefs({ autoBuyCooldownSec: n })}
            min={5}
            max={600}
            step={1}
          />
        </div>
      </div>

      <div className="rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5">
        <p className="text-[10px] tabular-nums text-white/70">
          Today: {stats.spentSol.toFixed(2)} / {dailyCap.toFixed(1)} SOL · {stats.buyCount} buys
        </p>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-emerald-500/70 transition-all"
            style={{ width: `${capPct}%` }}
          />
        </div>
      </div>

      <button
        type="button"
        data-demo="true"
        onClick={() =>
          dispatchAutoBuyEvent({
            mint: AUTO_BUY_DEMO_MINT,
            ticker: 'DEMO',
            amountSol: defaultSol,
            dataDemo: true,
          })
        }
        className="w-full rounded-lg border border-emerald-400/30 bg-emerald-500/10 py-2 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-500/15"
      >
        Fire test auto-buy
      </button>
      <p className="text-[9px] leading-snug" style={{ color: UI.muted }}>
        Dry-run only — no wallet call. Exercises the toast flow.
      </p>
    </GlassCard>
  );
}

function LaunchEngineCard({ inputCls }: { inputCls: string }) {
  const enabled = useAutoLaunchStore((s) => s.autoLaunchEnabled);
  const launchMode = useAutoLaunchStore((s) => s.launchMode);
  const launchBuySol = useAutoLaunchStore((s) => s.launchBuySol);
  const manualName = useAutoLaunchStore((s) => s.manualNameTemplate);
  const manualSymbol = useAutoLaunchStore((s) => s.manualSymbolTemplate);
  const useTweetImage = useAutoLaunchStore((s) => s.useTweetImageAsLogo);
  const aiStyle = useAutoLaunchStore((s) => s.aiStyle);
  const setPrefs = useAutoLaunchStore((s) => s.setPrefs);

  const aiStyles = [
    { id: 'meme' as const, label: 'Meme' },
    { id: 'balanced' as const, label: 'Balanced' },
    { id: 'serious' as const, label: 'Serious' },
  ];

  return (
    <GlassCard accent="violet" className="space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
            <Rocket className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-[#f0f4fc]">Launch on match</p>
            <p className="text-[9px] leading-snug" style={{ color: UI.muted }}>
              Deploy a new token when phrases hit — Rapid Launch vibes
            </p>
          </div>
        </div>
        <ToggleSwitch
          accent="violet"
          on={enabled}
          onChange={(v) => setPrefs({ autoLaunchEnabled: v })}
        />
      </div>

      {!enabled ? (
        <p className="rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-2 py-1.5 text-[10px] text-amber-200/90">
          Enable launch to save this rule with deploy intent.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
        <ModeChip
          active={launchMode === 'manual'}
          onClick={() => setPrefs({ launchMode: 'manual' })}
          icon={<Hand className="h-3 w-3" aria-hidden />}
          label="Manual"
        />
        <ModeChip
          active={launchMode === 'ai'}
          onClick={() => setPrefs({ launchMode: 'ai' })}
          icon={<Bot className="h-3 w-3" aria-hidden />}
          label="Pointer AI"
        />
      </div>

      {launchMode === 'manual' ? (
        <div className="space-y-2">
          <div>
            <FieldLabel hint="{tweet_keyword}">Name template</FieldLabel>
            <input
              value={manualName}
              onChange={(e) => setPrefs({ manualNameTemplate: e.target.value })}
              className={inputCls}
              style={{ borderColor: UI.border, backgroundColor: UI.elevated, color: UI.text }}
            />
          </div>
          <div>
            <FieldLabel hint="{keyword}">Symbol template</FieldLabel>
            <input
              value={manualSymbol}
              onChange={(e) => setPrefs({ manualSymbolTemplate: e.target.value })}
              className={inputCls}
              style={{ borderColor: UI.border, backgroundColor: UI.elevated, color: UI.text }}
            />
          </div>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2 py-1.5">
            <input
              type="checkbox"
              checked={useTweetImage}
              onChange={(e) => setPrefs({ useTweetImageAsLogo: e.target.checked })}
              className="mt-0.5 rounded border"
              style={{ borderColor: UI.border }}
            />
            <span className="text-[10px] leading-snug text-white/75">
              Use tweet image as token logo when available
            </span>
          </label>
        </div>
      ) : (
        <div className="space-y-2">
          <FieldLabel>AI tone</FieldLabel>
          <div className="flex flex-wrap gap-1">
            {aiStyles.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setPrefs({ aiStyle: s.id })}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[10px] font-semibold transition',
                  aiStyle === s.id
                    ? 'border-violet-400/40 bg-violet-500/15 text-violet-100'
                    : 'border-white/[0.08] text-fg-muted hover:bg-white/[0.04]',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="flex items-center gap-1 text-[9px] leading-snug" style={{ color: UI.muted }}>
            <Sparkles className="h-3 w-3 shrink-0 text-violet-300/80" aria-hidden />
            Pointer drafts name, symbol, and copy from the tweet — you review before it goes live.
          </p>
        </div>
      )}

      <div>
        <FieldLabel hint="Dev buy at deploy">Launch buy (SOL)</FieldLabel>
        <MiniNumber
          value={launchBuySol}
          onChange={(n) => setPrefs({ launchBuySol: n })}
          min={0.01}
          max={100}
          step={0.01}
        />
      </div>

      <p className="rounded-lg border border-violet-400/20 bg-violet-500/[0.06] px-2 py-1.5 text-[9px] leading-snug text-violet-100/85">
        Deploy execution is coming next — rules save your launch prefs now; no on-chain deploy yet.
      </p>
    </GlassCard>
  );
}

export function AlertBuilderTwitterActionPanel({
  execution,
  onExecutionChange,
  buySol,
  onBuySolChange,
  inputCls,
}: {
  execution: TwitterRuleExecution;
  onExecutionChange: (v: TwitterRuleExecution) => void;
  buySol: string;
  onBuySolChange: (v: string) => void;
  inputCls: string;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
        <ActionTab
          active={execution === 'notify'}
          onClick={() => onExecutionChange('notify')}
          icon={<Bell className="h-3.5 w-3.5" aria-hidden />}
        >
          Notify
        </ActionTab>
        <ActionTab
          active={execution === 'auto_buy'}
          onClick={() => onExecutionChange('auto_buy')}
          icon={<Zap className="h-3.5 w-3.5" aria-hidden />}
        >
          Auto-buy
        </ActionTab>
        <ActionTab
          active={execution === 'auto_launch'}
          onClick={() => onExecutionChange('auto_launch')}
          icon={<Rocket className="h-3.5 w-3.5" aria-hidden />}
        >
          Launch
        </ActionTab>
      </div>

      {execution === 'notify' ? (
        <p className="text-[10px] leading-snug" style={{ color: UI.muted }}>
          Flash, sound, and rail only — no wallet action on match.
        </p>
      ) : null}

      {execution === 'auto_buy' ? (
        <AutoBuyEngineCard buySol={buySol} onBuySolChange={onBuySolChange} inputCls={inputCls} />
      ) : null}

      {execution === 'auto_launch' ? <LaunchEngineCard inputCls={inputCls} /> : null}
    </div>
  );
}
