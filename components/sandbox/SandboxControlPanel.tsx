'use client';

import { useEffect, useMemo, useState } from 'react';
import { FlaskConical, RotateCcw, Zap, Wallet, Package, Radio, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import { useSandboxEnabled } from '@/components/sandbox/SandboxProvider';
import { useSandboxWallet } from '@/lib/hooks/useSandboxWallet';
import { useSandboxTrades } from '@/lib/hooks/useSandboxTrades';
import { useSandboxLedger } from '@/lib/sandbox/ledger';
import { sandboxMarket } from '@/lib/sandbox/market';
import { sandboxBuy } from '@/lib/sandbox/trade';
import { rollSandboxPack, SANDBOX_PACK_PRICES_SOL } from '@/lib/sandbox/packs';
import { enableSandboxMode, disableSandboxMode, isSandboxForcedByEnv } from '@/lib/sandbox/mode';
import type { SandboxMarketToken } from '@/lib/sandbox/types';

function num(n: number, d = 4): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-border-subtle bg-bg-raised">
      <header className="flex items-center gap-2 border-b border-border-subtle px-3 py-2 text-sm font-semibold text-fg-primary">
        {icon}
        {title}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

export function SandboxControlPanel() {
  const enabled = useSandboxEnabled();
  const { wallets, activeWallet, activePositions, totals, championship, setActiveWallet, createSubWallet, allocateToWallet, reset } =
    useSandboxWallet();
  const { buy, sellPct, trades, txs } = useSandboxTrades();
  const packOpens = useSandboxLedger((s) => s.packOpens);
  const automation = useSandboxLedger((s) => s.automation);
  const recordPackOpen = useSandboxLedger((s) => s.recordPackOpen);
  const pushAutomationEvent = useSandboxLedger((s) => s.pushAutomationEvent);

  const [market, setMarket] = useState<SandboxMarketToken[]>(() => sandboxMarket().snapshot());
  const [buyMint, setBuyMint] = useState(() => sandboxMarket().snapshot()[0]?.mint ?? '');
  const [buyAmount, setBuyAmount] = useState('1');
  const [allocLabel, setAllocLabel] = useState('');
  const [allocAmount, setAllocAmount] = useState('5');
  const [allocTarget, setAllocTarget] = useState('');

  useEffect(() => {
    const m = sandboxMarket();
    m.start();
    return m.subscribe(setMarket);
  }, []);

  const selectedToken = useMemo(() => market.find((t) => t.mint === buyMint) ?? market[0], [market, buyMint]);

  if (!enabled) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-md border border-border-subtle bg-bg-raised p-6 text-center">
        <FlaskConical className="mx-auto h-8 w-8 text-amber-300" />
        <h2 className="mt-3 text-base font-semibold text-fg-primary">Sandbox mode is off</h2>
        <p className="mt-2 text-sm text-fg-secondary">
          Enable a fully fake terminal — fake balances, fills, packs, and PnL. No real funds, no
          transactions, no live data.
        </p>
        <button
          type="button"
          onClick={() => {
            enableSandboxMode();
            toast.success('Sandbox mode enabled');
          }}
          className="btn-press mt-4 rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:brightness-105"
        >
          Enable Sandbox
        </button>
      </div>
    );
  }

  const onBuy = () => {
    const amt = Number(buyAmount);
    if (!selectedToken) return;
    buy(selectedToken.mint, selectedToken.symbol, amt);
  };

  const onOpenPack = (packType: string) => {
    const open = rollSandboxPack(packType);
    const res = recordPackOpen(open, open.priceSol);
    if (res.ok) {
      toast.success(`SANDBOX ${packType} pack opened`, {
        description: `+${num(open.totalValueSol)} SOL value · ${open.highlightRarity} · fake`,
      });
    } else {
      toast.error('SANDBOX pack failed', { description: res.error });
    }
  };

  const fireKolSignal = () => {
    const pumpers = market.filter((t) => t.bias === 'pump');
    const target = pumpers[Math.floor(Math.random() * pumpers.length)] ?? market[0];
    if (!target) return;
    pushAutomationEvent({
      kind: 'kol_signal',
      handle: 'sandbox_kol',
      text: `New call: $${target.symbol} looking ready to send`,
      mint: target.mint,
      symbol: target.symbol,
    });
    toast.message('SANDBOX KOL signal', { description: `@sandbox_kol → $${target.symbol}` });
  };

  const fireAutoBuy = () => {
    const target = market.find((t) => t.bias === 'pump') ?? market[0];
    if (!target) return;
    const res = sandboxBuy({ mint: target.mint, symbol: target.symbol, amountSol: 0.5, source: 'autobuy' });
    pushAutomationEvent({
      kind: 'autobuy',
      handle: 'rule:pump-keyword',
      text: res.ok ? `Auto-bought 0.5 SOL of $${target.symbol}` : `Auto-buy failed: ${res.error}`,
      mint: target.mint,
      symbol: target.symbol,
      amountSol: 0.5,
      txHash: res.ok ? res.tx.hash : undefined,
    });
    if (res.ok) toast.success('SANDBOX auto-buy fired', { description: `$${target.symbol} · fake` });
    else toast.error('SANDBOX auto-buy failed', { description: res.error });
  };

  const fireAutoLaunch = () => {
    const sym = `SBXL${Math.floor(Math.random() * 999)}`;
    pushAutomationEvent({
      kind: 'autolaunch',
      handle: 'rule:auto-launch',
      text: `Launched fake token $${sym} from tweet trigger`,
      symbol: sym,
      mint: `SBXLAUNCH_${Date.now()}`,
    });
    toast.success('SANDBOX auto-launch', { description: `$${sym} created · fake` });
  };

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2.5">
        <div className="flex items-center gap-2 text-amber-200">
          <FlaskConical className="h-4 w-4" />
          <span className="text-sm font-semibold uppercase tracking-wide">Sandbox Mode</span>
          <span className="text-xs text-amber-300/80">Fake everything · no real funds, fills, or payouts</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (confirm('Reset all sandbox state to 100 SOL?')) {
                reset();
                toast.success('Sandbox reset');
              }
            }}
            className="btn-press inline-flex items-center gap-1.5 rounded-sm border border-border-subtle px-2.5 py-1 text-xs font-medium text-fg-secondary hover:text-fg-primary"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
          {!isSandboxForcedByEnv() ? (
            <button
              type="button"
              onClick={() => {
                disableSandboxMode();
                toast.success('Sandbox disabled — live UI restored');
              }}
              className="btn-press rounded-sm border border-border-subtle px-2.5 py-1 text-xs font-medium text-fg-secondary hover:text-fg-primary"
            >
              Disable
            </button>
          ) : (
            <span className="text-[10px] text-amber-300/70">forced by env</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'SOL balance', value: `${num(totals.solBalance, 2)}` },
          { label: 'Equity (SOL)', value: `${num(totals.equitySol, 2)}` },
          { label: 'Unrealized PnL', value: `${totals.unrealizedPnlSol >= 0 ? '+' : ''}${num(totals.unrealizedPnlSol, 3)}` },
          { label: 'Realized PnL', value: `${totals.realizedPnlSol >= 0 ? '+' : ''}${num(totals.realizedPnlSol, 3)}` },
        ].map((c) => (
          <div key={c.label} className="rounded-md border border-border-subtle bg-bg-raised p-3">
            <div className="text-[11px] uppercase tracking-wide text-fg-muted">{c.label}</div>
            <div className="mt-1 font-mono text-lg tabular-nums text-fg-primary">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Section title="Trade (sandbox market)" icon={<Zap className="h-4 w-4 text-amber-300" />}>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-fg-muted">
              Token
              <select
                value={buyMint}
                onChange={(e) => setBuyMint(e.target.value)}
                className="rounded-sm border border-border-subtle bg-bg-sunken px-2 py-1.5 text-sm text-fg-primary"
              >
                {market.map((t) => (
                  <option key={t.mint} value={t.mint}>
                    {t.symbol} · {num(t.priceSol, 8)} SOL ({t.changePct >= 0 ? '+' : ''}
                    {t.changePct.toFixed(1)}%)
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-fg-muted">
              Amount SOL
              <input
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                inputMode="decimal"
                className="w-24 rounded-sm border border-border-subtle bg-bg-sunken px-2 py-1.5 text-sm text-fg-primary"
              />
            </label>
            <button
              type="button"
              onClick={onBuy}
              className="btn-press rounded-sm bg-signal-bull/90 px-3 py-1.5 text-sm font-semibold text-black hover:brightness-105"
            >
              Buy
            </button>
          </div>
          <p className="mt-2 text-[11px] text-fg-muted">
            Token-page buy/sell buttons also route here while sandbox is on.
          </p>
        </Section>

        <Section title="Championship (sandbox)" icon={<Trophy className="h-4 w-4 text-amber-300" />}>
          <div className="flex items-end gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-fg-muted">PTCS score</div>
              <div className="font-mono text-3xl tabular-nums text-fg-primary">{championship.ptcs}</div>
            </div>
            <div className="text-xs text-fg-secondary">
              <div>{championship.trades} trades</div>
              <div>best {num(championship.bestTradePnlSol, 3)} SOL</div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-amber-300/80">Sandbox score — not official ranking.</p>
        </Section>
      </div>

      <Section title="Positions" icon={<Wallet className="h-4 w-4 text-amber-300" />}>
        {activePositions.length === 0 ? (
          <p className="text-sm text-fg-muted">No sandbox positions yet. Buy a token above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-fg-muted">
                  <th className="py-1 pr-3">Token</th>
                  <th className="py-1 pr-3 text-right">Amount</th>
                  <th className="py-1 pr-3 text-right">Value (SOL)</th>
                  <th className="py-1 pr-3 text-right">uPnL</th>
                  <th className="py-1 pr-3" />
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {activePositions.map((p) => (
                  <tr key={p.mint} className="border-t border-border-subtle/60">
                    <td className="py-1.5 pr-3 font-sans">{p.symbol}</td>
                    <td className="py-1.5 pr-3 text-right">{num(p.amount, 2)}</td>
                    <td className="py-1.5 pr-3 text-right">{num(p.valueSol, 4)}</td>
                    <td className={cn('py-1.5 pr-3 text-right', p.unrealizedPnlSol >= 0 ? 'text-signal-bull' : 'text-signal-bear')}>
                      {p.unrealizedPnlSol >= 0 ? '+' : ''}
                      {num(p.unrealizedPnlSol, 4)}
                    </td>
                    <td className="py-1.5 pr-3 text-right">
                      <button
                        type="button"
                        onClick={() => sellPct(p.mint, p.symbol, 100)}
                        className="btn-press rounded-sm border border-border-subtle px-2 py-0.5 text-xs text-fg-secondary hover:text-fg-primary"
                      >
                        Sell all
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Section title="Split wallets" icon={<Wallet className="h-4 w-4 text-amber-300" />}>
          <div className="space-y-1.5">
            {wallets.map((w) => (
              <div
                key={w.id}
                className={cn(
                  'flex items-center justify-between rounded-sm border px-2 py-1.5 text-sm',
                  w.id === activeWallet?.id ? 'border-amber-400/40 bg-amber-400/5' : 'border-border-subtle',
                )}
              >
                <button type="button" onClick={() => setActiveWallet(w.id)} className="text-left">
                  <span className="font-medium text-fg-primary">{w.label}</span>
                  {w.isPrimary ? <span className="ml-1 text-[10px] text-fg-muted">primary</span> : null}
                  {w.id === activeWallet?.id ? <span className="ml-1 text-[10px] text-amber-300">active</span> : null}
                </button>
                <span className="font-mono tabular-nums text-fg-secondary">{num(w.solBalance, 3)} SOL</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <input
              value={allocLabel}
              onChange={(e) => setAllocLabel(e.target.value)}
              placeholder="New split label"
              className="w-32 rounded-sm border border-border-subtle bg-bg-sunken px-2 py-1.5 text-sm text-fg-primary"
            />
            <button
              type="button"
              onClick={() => {
                const w = createSubWallet(allocLabel);
                setAllocTarget(w.id);
                setAllocLabel('');
                toast.success('Split wallet created', { description: w.label });
              }}
              className="btn-press rounded-sm border border-border-subtle px-2.5 py-1.5 text-sm text-fg-secondary hover:text-fg-primary"
            >
              + Split
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <select
              value={allocTarget}
              onChange={(e) => setAllocTarget(e.target.value)}
              className="rounded-sm border border-border-subtle bg-bg-sunken px-2 py-1.5 text-sm text-fg-primary"
            >
              <option value="">Select split…</option>
              {wallets.filter((w) => !w.isPrimary).map((w) => (
                <option key={w.id} value={w.id}>{w.label}</option>
              ))}
            </select>
            <input
              value={allocAmount}
              onChange={(e) => setAllocAmount(e.target.value)}
              inputMode="decimal"
              className="w-20 rounded-sm border border-border-subtle bg-bg-sunken px-2 py-1.5 text-sm text-fg-primary"
            />
            <button
              type="button"
              onClick={() => {
                if (!allocTarget) return;
                const res = allocateToWallet(allocTarget, Number(allocAmount));
                if (res.ok) toast.success('Allocated fake SOL');
                else toast.error('Allocation failed', { description: res.error });
              }}
              className="btn-press rounded-sm border border-border-subtle px-2.5 py-1.5 text-sm text-fg-secondary hover:text-fg-primary"
            >
              Allocate
            </button>
          </div>
        </Section>

        <Section title="Packs (sandbox)" icon={<Package className="h-4 w-4 text-amber-300" />}>
          <div className="flex flex-wrap gap-2">
            {Object.keys(SANDBOX_PACK_PRICES_SOL).map((pt) => (
              <button
                key={pt}
                type="button"
                onClick={() => onOpenPack(pt)}
                className="btn-press rounded-sm border border-border-subtle px-3 py-1.5 text-sm capitalize text-fg-secondary hover:text-fg-primary"
              >
                {pt} · {SANDBOX_PACK_PRICES_SOL[pt]} SOL
              </button>
            ))}
          </div>
          <div className="mt-3 max-h-32 space-y-1 overflow-y-auto text-xs">
            {packOpens.slice(0, 8).map((o) => (
              <div key={o.openId} className="flex justify-between text-fg-secondary">
                <span className="capitalize">{o.packType} · {o.highlightRarity}</span>
                <span className="font-mono tabular-nums">+{num(o.totalValueSol, 3)} SOL</span>
              </div>
            ))}
            {packOpens.length === 0 ? <p className="text-fg-muted">No sandbox packs opened.</p> : null}
          </div>
        </Section>
      </div>

      <Section title="Automation (sandbox)" icon={<Radio className="h-4 w-4 text-amber-300" />}>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={fireKolSignal} className="btn-press rounded-sm border border-border-subtle px-3 py-1.5 text-sm text-fg-secondary hover:text-fg-primary">
            Fire KOL signal
          </button>
          <button type="button" onClick={fireAutoBuy} className="btn-press rounded-sm border border-border-subtle px-3 py-1.5 text-sm text-fg-secondary hover:text-fg-primary">
            Fire auto-buy
          </button>
          <button type="button" onClick={fireAutoLaunch} className="btn-press rounded-sm border border-border-subtle px-3 py-1.5 text-sm text-fg-secondary hover:text-fg-primary">
            Fire auto-launch
          </button>
        </div>
        <div className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs">
          {automation.slice(0, 12).map((e) => (
            <div key={e.id} className="flex items-center gap-2 text-fg-secondary">
              <span className="rounded-sm bg-amber-400/10 px-1.5 py-0.5 text-[10px] uppercase text-amber-300">{e.kind}</span>
              <span className="truncate">{e.text}</span>
            </div>
          ))}
          {automation.length === 0 ? <p className="text-fg-muted">No sandbox automation events.</p> : null}
        </div>
      </Section>

      <Section title="Transaction history (sandbox)" icon={<Zap className="h-4 w-4 text-amber-300" />}>
        <div className="max-h-56 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left uppercase tracking-wide text-fg-muted">
                <th className="py-1 pr-2">Hash</th>
                <th className="py-1 pr-2">Kind</th>
                <th className="py-1 pr-2 text-right">SOL</th>
                <th className="py-1 pr-2 text-right">Latency</th>
                <th className="py-1 pr-2 text-right">Slippage</th>
                <th className="py-1 pr-2">Route</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {txs.slice(0, 40).map((t) => (
                <tr key={t.hash} className="border-t border-border-subtle/60">
                  <td className="py-1 pr-2 text-fg-secondary">{t.hash.slice(0, 22)}…</td>
                  <td className="py-1 pr-2 font-sans">{t.kind}</td>
                  <td className="py-1 pr-2 text-right">{num(t.amountSol, 4)}</td>
                  <td className="py-1 pr-2 text-right">{t.latencyMs}ms</td>
                  <td className="py-1 pr-2 text-right">{t.slippageBps}bps</td>
                  <td className="py-1 pr-2 font-sans text-amber-300">{t.route}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {txs.length === 0 ? <p className="text-fg-muted">No sandbox transactions yet.</p> : null}
        </div>
      </Section>
    </div>
  );
}
