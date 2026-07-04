'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  AUTO_SELL_DEMO_MINT,
  dispatchAutoSellEvent,
} from '@/lib/alerts/autoSellDispatch';
import {
  DEFAULT_AUTO_SELL_RULE,
  type AutoSellRule,
  type AutoSellTokenScope,
  type AutoSellTrigger,
} from '@/lib/autoSell/types';
import { triggerSummary } from '@/lib/autoSell/evaluateTrigger';
import { cn } from '@/lib/utils/cn';
import { useAutoSellStore } from '@/store/autoSell';

function ToggleSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors',
        on ? 'bg-rose-500/80' : 'bg-white/10',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
          on ? 'left-[22px]' : 'left-0.5',
        )}
      />
    </button>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step: number;
  className?: string;
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
      className={cn(
        'w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-2 py-1.5 text-right text-[13px] tabular-nums text-white/90 outline-none focus:border-white/20',
        className,
      )}
    />
  );
}

function emptyRule(): AutoSellRule {
  return {
    id: crypto.randomUUID(),
    ...DEFAULT_AUTO_SELL_RULE,
    name: 'New rule',
  };
}

export function AutoSellSettings() {
  const enabled = useAutoSellStore((s) => s.autoSellEnabled);
  const rules = useAutoSellStore((s) => s.rules);
  const cooldownSec = useAutoSellStore((s) => s.cooldownSec);
  const setPrefs = useAutoSellStore((s) => s.setPrefs);
  const addRule = useAutoSellStore((s) => s.addRule);
  const updateRule = useAutoSellStore((s) => s.updateRule);
  const removeRule = useAutoSellStore((s) => s.removeRule);

  const [draft, setDraft] = useState<AutoSellRule | null>(null);

  const editing = draft ?? emptyRule();

  const triggerFields = useMemo(() => {
    const t = editing.trigger;
    switch (t.type) {
      case 'mc_milestone':
        return (
          <label className="block space-y-1">
            <span className="text-[11px] text-white/50">Target market cap (USD)</span>
            <NumberInput
              value={t.targetMcUsd}
              onChange={(n) =>
                setDraft((d) =>
                  d
                    ? { ...d, trigger: { type: 'mc_milestone', targetMcUsd: n } }
                    : { ...editing, trigger: { type: 'mc_milestone', targetMcUsd: n } },
                )
              }
              min={1}
              max={1_000_000_000}
              step={1000}
            />
          </label>
        );
      case 'stop_loss_mc':
        return (
          <label className="block space-y-1">
            <span className="text-[11px] text-white/50">Stop if MC falls below (USD)</span>
            <NumberInput
              value={t.mcUsd}
              onChange={(n) =>
                setDraft((d) =>
                  d
                    ? { ...d, trigger: { type: 'stop_loss_mc', mcUsd: n } }
                    : { ...editing, trigger: { type: 'stop_loss_mc', mcUsd: n } },
                )
              }
              min={1}
              max={1_000_000_000}
              step={1000}
            />
          </label>
        );
      case 'pct_gain':
        return (
          <label className="block space-y-1">
            <span className="text-[11px] text-white/50">Unrealized gain %</span>
            <NumberInput
              value={t.gainPct}
              onChange={(n) =>
                setDraft((d) =>
                  d
                    ? { ...d, trigger: { type: 'pct_gain', gainPct: n } }
                    : { ...editing, trigger: { type: 'pct_gain', gainPct: n } },
                )
              }
              min={1}
              max={10_000}
              step={1}
            />
          </label>
        );
      case 'time_elapsed':
        return (
          <label className="block space-y-1">
            <span className="text-[11px] text-white/50">Minutes since position opened</span>
            <NumberInput
              value={t.minutes}
              onChange={(n) =>
                setDraft((d) =>
                  d
                    ? { ...d, trigger: { type: 'time_elapsed', minutes: n } }
                    : { ...editing, trigger: { type: 'time_elapsed', minutes: n } },
                )
              }
              min={1}
              max={60 * 24 * 30}
              step={1}
            />
          </label>
        );
      case 'trailing_stop':
        return (
          <label className="block space-y-1">
            <span className="text-[11px] text-white/50">Trail % below the peak</span>
            <NumberInput
              value={t.trailPct}
              onChange={(n) =>
                setDraft((d) =>
                  d
                    ? { ...d, trigger: { type: 'trailing_stop', trailPct: n } }
                    : { ...editing, trigger: { type: 'trailing_stop', trailPct: n } },
                )
              }
              min={0.5}
              max={90}
              step={0.5}
            />
            <span className="text-[10px] text-white/35">
              The stop rises with the price; sells if it drops this % from the highest point.
            </span>
          </label>
        );
      default:
        return null;
    }
  }, [editing]);

  function saveDraft() {
    const next = draft ?? editing;
    const exists = rules.some((r) => r.id === next.id);
    if (exists) updateRule(next.id, next);
    else addRule(next);
    setDraft(null);
  }

  function startEdit(rule: AutoSellRule) {
    setDraft({ ...rule });
  }

  function setTriggerType(type: AutoSellTrigger['type']) {
    const base = draft ?? editing;
    let trigger: AutoSellTrigger;
    switch (type) {
      case 'mc_milestone':
        trigger = { type: 'mc_milestone', targetMcUsd: 1_000_000 };
        break;
      case 'stop_loss_mc':
        trigger = { type: 'stop_loss_mc', mcUsd: 100_000 };
        break;
      case 'pct_gain':
        trigger = { type: 'pct_gain', gainPct: 50 };
        break;
      case 'time_elapsed':
        trigger = { type: 'time_elapsed', minutes: 30 };
        break;
      case 'trailing_stop':
        trigger = { type: 'trailing_stop', trailPct: 10 };
        break;
      default:
        trigger = { type: 'pct_gain', gainPct: 50 };
    }
    setDraft({ ...base, trigger });
  }

  return (
    <section className="space-y-4 py-3">
      <div className="flex items-start justify-between gap-4 border-b border-white/[0.04] pb-3">
        <div>
          <h3 className="text-[13px] font-medium text-white/85">Enable Auto-Sell</h3>
          <p className="mt-0.5 text-[11px] text-white/40">
            When a rule fires, sell via the same Jupiter path as quick-sell — no confirmation modal.
          </p>
        </div>
        <ToggleSwitch on={enabled} onChange={(v) => setPrefs({ autoSellEnabled: v })} />
      </div>

      <label className="flex items-center justify-between gap-4 border-b border-white/[0.04] py-3">
        <div>
          <p className="text-[13px] text-white/85">Per-rule cooldown (seconds)</p>
          <p className="mt-0.5 text-[11px] text-white/40">Minimum time between sells for the same rule + mint.</p>
        </div>
        <NumberInput
          value={cooldownSec}
          onChange={(n) => setPrefs({ cooldownSec: n })}
          min={10}
          max={3600}
          step={5}
          className="w-[88px]"
        />
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Rules</p>
          <button
            type="button"
            onClick={() => setDraft(emptyRule())}
            className="inline-flex items-center gap-1 rounded-md border border-white/[0.1] px-2 py-1 text-[11px] font-medium text-white/80 hover:bg-white/[0.04]"
          >
            <Plus className="h-3 w-3" aria-hidden />
            Add rule
          </button>
        </div>

        {rules.length === 0 ? (
          <p className="text-[11px] text-white/40">No rules yet — add one to start monitoring positions.</p>
        ) : (
          <ul className="space-y-2">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(rule)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-[12px] font-semibold text-white/90">
                      {rule.name}
                      {!rule.enabled ? (
                        <span className="ml-1 text-[10px] font-normal text-white/40">(off)</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-[10px] text-white/45">
                      {rule.tokenScope.kind === 'all_held'
                        ? 'All held tokens'
                        : rule.tokenScope.mint.slice(0, 8) + '…'}{' '}
                      · {triggerSummary(rule.trigger)} · sell {rule.sellPct}%
                    </p>
                  </button>
                  <button
                    type="button"
                    aria-label="Delete rule"
                    onClick={() => removeRule(rule.id)}
                    className="rounded p-1 text-white/40 hover:bg-white/[0.06] hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {draft != null ? (
        <div className="space-y-3 rounded-lg border border-rose-400/20 bg-rose-500/[0.06] p-3">
          <p className="text-[11px] font-semibold text-rose-100/90">Rule editor</p>
          <label className="block space-y-1">
            <span className="text-[11px] text-white/50">Name</span>
            <input
              value={editing.name}
              onChange={(e) => setDraft({ ...editing, name: e.target.value })}
              className="w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-2 py-1.5 text-[13px] text-white/90"
            />
          </label>

          <label className="flex items-center gap-2 text-[12px] text-white/75">
            <input
              type="checkbox"
              checked={editing.enabled}
              onChange={(e) => setDraft({ ...editing, enabled: e.target.checked })}
            />
            Rule enabled
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="text-[11px] text-white/50">Token</span>
              <select
                value={editing.tokenScope.kind}
                onChange={(e) => {
                  const kind = e.target.value as AutoSellTokenScope['kind'];
                  const tokenScope: AutoSellTokenScope =
                    kind === 'all_held'
                      ? { kind: 'all_held' }
                      : {
                          kind: 'mint',
                          mint: editing.tokenScope.kind === 'mint' ? editing.tokenScope.mint : '',
                        };
                  setDraft({ ...editing, tokenScope });
                }}
                className="w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-2 py-1.5 text-[12px] text-white/90"
              >
                <option value="all_held">All tokens I hold</option>
                <option value="mint">Specific mint</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] text-white/50">Wallet</span>
              <select
                disabled
                value="primary"
                className="w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-2 py-1.5 text-[12px] text-white/50"
              >
                <option value="primary">Primary wallet</option>
              </select>
            </label>
          </div>

          {editing.tokenScope.kind === 'mint' ? (
            <label className="block space-y-1">
              <span className="text-[11px] text-white/50">Mint address</span>
              <input
                value={editing.tokenScope.mint}
                onChange={(e) =>
                  setDraft({
                    ...editing,
                    tokenScope: { kind: 'mint', mint: e.target.value.trim() },
                  })
                }
                placeholder="Token mint"
                className="w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-2 py-1.5 font-mono text-[12px] text-white/90"
              />
            </label>
          ) : null}

          <label className="block space-y-1">
            <span className="text-[11px] text-white/50">Trigger</span>
            <select
              value={editing.trigger.type}
              onChange={(e) => setTriggerType(e.target.value as AutoSellTrigger['type'])}
              className="w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-2 py-1.5 text-[12px] text-white/90"
            >
              <option value="pct_gain">% gain on position</option>
              <option value="mc_milestone">MC milestone</option>
              <option value="time_elapsed">Time elapsed</option>
              <option value="stop_loss_mc">Stop-loss MC</option>
              <option value="trailing_stop">Trailing stop loss</option>
            </select>
          </label>

          {triggerFields}

          <label className="block space-y-1">
            <span className="text-[11px] text-white/50">Sell % of holdings</span>
            <NumberInput
              value={editing.sellPct}
              onChange={(n) => setDraft({ ...editing, sellPct: Math.min(100, Math.max(1, n)) })}
              min={1}
              max={100}
              step={1}
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveDraft}
              className="flex-1 rounded-lg bg-rose-500/20 py-2 text-[12px] font-semibold text-rose-100 hover:bg-rose-500/30"
            >
              Save rule
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-lg border border-white/[0.1] px-3 py-2 text-[12px] text-white/70"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        data-demo="true"
        onClick={() =>
          dispatchAutoSellEvent({
            mint: AUTO_SELL_DEMO_MINT,
            ticker: 'DEMO',
            sellPct: 25,
            dataDemo: true,
          })
        }
        className="w-full rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-[13px] font-semibold text-rose-200 transition hover:bg-rose-500/15"
      >
        Fire test auto-sell
      </button>
      <p className="text-[11px] text-white/40">
        Dry-run only — no wallet call, no tokens sold. Exercises the toast flow.
      </p>
    </section>
  );
}
