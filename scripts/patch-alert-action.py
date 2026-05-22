from pathlib import Path

p = Path(__file__).resolve().parents[1] / "components/alerts/AlertRulesSection.tsx"
t = p.read_text(encoding="utf-8")

start = t.find("              {creatorKind === 'sol_twitter_listen' ? (\n                <>\n                  <motionless")
if start < 0:
    start = t.find("              {creatorKind === 'sol_twitter_listen' ? (\n                <>\n                  <div className=\"grid grid-cols-2")

end = t.find("                  <div className=\"space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5\">", start)
if start < 0 or end < 0:
    raise SystemExit(f"markers not found start={start} end={end}")

new = r"""              {creatorKind === 'sol_twitter_listen' ? (
                <>
                  <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
                    <button
                      type="button"
                      onClick={() => setTwExecution('notify')}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-semibold transition',
                        twExecution === 'notify'
                          ? 'bg-white/[0.11] text-[#f0f4fc] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]'
                          : 'text-fg-muted hover:bg-white/[0.04]',
                      )}
                    >
                      <Bell className="h-3.5 w-3.5 opacity-80" aria-hidden />
                      Notify
                    </button>
                    <button
                      type="button"
                      onClick={() => setTwExecution('auto_buy')}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-semibold transition',
                        twExecution === 'auto_buy'
                          ? 'bg-white/[0.11] text-[#f0f4fc] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]'
                          : 'text-fg-muted hover:bg-white/[0.04]',
                      )}
                    >
                      <Zap className="h-3.5 w-3.5 text-emerald-400/90" aria-hidden />
                      Auto-buy
                    </button>
                    <button
                      type="button"
                      onClick={() => setTwExecution('auto_launch')}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-semibold transition',
                        twExecution === 'auto_launch'
                          ? 'bg-white/[0.11] text-[#f0f4fc] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]'
                          : 'text-fg-muted hover:bg-white/[0.04]',
                      )}
                    >
                      <Rocket className="h-3.5 w-3.5 text-violet-300/90" aria-hidden />
                      Launch
                    </button>
                  </div>

                  {twExecution === 'notify' ? (
                    <p className="text-[10px] leading-snug" style={{ color: UI.muted }}>
                      Flash, sound, and Pulse rail — no trade or deploy.
                    </p>
                  ) : null}

                  {twExecution === 'auto_buy' ? (
                    <AlertBuilderAutoBuyEngine
                      buySol={twBuySol}
                      onBuySolChange={setTwBuySol}
                      inputCls={inputCls}
                    />
                  ) : null}

                  {twExecution === 'auto_launch' ? <AlertBuilderLaunchEngine /> : null}

"""

t = t[:start] + new + t[end:]
p.write_text(t, encoding="utf-8")
print("patched action block")

helpers = r'''

function BuilderToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors',
        on ? 'bg-emerald-500/85' : 'bg-white/10',
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

function BuilderMiniNumber({
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

function AlertBuilderAutoBuyEngine({
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
    <div className="space-y-2.5 rounded-xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.08] to-transparent p-2.5">
      <motionlessHeader className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
            <Zap className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-[#f0f4fc]">Auto-buyer engine</p>
            <p className="text-[9px] leading-snug" style={{ color: UI.muted }}>
              Instant buy on match — no modal
            </p>
          </motionlessHeader>
        </motionlessHeader>
        <BuilderToggle on={enabled} onChange={(v) => setPrefs({ autoBuyEnabled: v })} />
      </motionlessHeader>

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
        </motionlessCol>
        <div>
          <FieldLabel hint="Fallback">Default SOL</FieldLabel>
          <BuilderMiniNumber
            value={defaultSol}
            onChange={(n) => setPrefs({ defaultAutoBuySol: n })}
            min={0.01}
            max={100}
            step={0.01}
          />
        </motionlessCol>
      </motionlessGrid>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel>Daily cap</FieldLabel>
          <BuilderMiniNumber
            value={dailyCap}
            onChange={(n) => setPrefs({ autoBuyDailyCapSol: n })}
            min={0.1}
            max={1000}
            step={0.1}
          />
        </motionlessCol>
        <div>
          <FieldLabel>Cooldown (s)</FieldLabel>
          <BuilderMiniNumber
            value={cooldownSec}
            onChange={(n) => setPrefs({ autoBuyCooldownSec: n })}
            min={5}
            max={600}
            step={1}
          />
        </motionlessCol>
      </motionlessGrid>

      <div className="rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5">
        <p className="text-[10px] tabular-nums text-white/70">
          Today: {stats.spentSol.toFixed(2)} / {dailyCap.toFixed(1)} SOL · {stats.buyCount} buys
        </p>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-emerald-500/70 transition-all"
            style={{ width: `${capPct}%` }}
          />
        </motionlessBarTrack>
      </motionlessStats>

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
    </motionlessCard>
  );
}

'''

# Fix motionless tags in helpers before append
import re
helpers = re.sub(r'</?motionless[A-Za-z]+>', lambda m: '</motionlessX>' if m.group(0).startswith('</') else '<motionlessX>', helpers)
helpers = helpers.replace('</motionlessX>', '</' + 'div' + '>').replace('<motionlessX>', '<motionlessX>')
helpers = helpers.replace('<motionlessX>', '<motionlessX>')
# broken - do properly
helpers = open(Path(__file__).parent / 'alert-builder-helpers.tsx', encoding='utf-8').read() if (Path(__file__).parent / 'alert-builder-helpers.tsx').exists() else None
