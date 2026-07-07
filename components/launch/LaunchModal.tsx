'use client';

import { useEffect, useState } from 'react';
import { BadgePercent, Layers, ListChecks, Loader2, Rocket, Split, Users, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { CloseButton } from '@/components/ui/CloseButton';
import { useClientLaunch } from '@/lib/launch/useClientLaunch';
import {
  launchpadsForChain,
  type LaunchPackageLaunchpad,
} from '@/lib/launch/types';
import { protocolBrand } from '@/lib/tokens/protocolBrand';
import { ProtocolBrandIcon } from '@/components/tokens/ProtocolBrandIcon';
import { useOverlayPresence, OVERLAY_ANIM_CLOSE_MS } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
import { Z_APP_MODAL_OVERLAY } from '@/lib/ui/zLayers';
import { cn } from '@/lib/utils/cn';
import { useAutoLaunchStore } from '@/store/autoLaunch';
import { DEFAULT_LAUNCH_FEATURES, useLaunchModalStore, type LaunchFeatures } from '@/store/launchModal';
import { useXMonitorSettings } from '@/store/xMonitorSettings';

export function LaunchModal() {
  const open = useLaunchModalStore((s) => s.open);
  const draft = useLaunchModalStore((s) => s.draft);
  const patchDraft = useLaunchModalStore((s) => s.patchDraft);
  const close = useLaunchModalStore((s) => s.close);
  const defaultBuySol = useAutoLaunchStore((s) => s.launchBuySol);
  const feePreset = useXMonitorSettings((s) => s.feePreset);
  const deployMode = useXMonitorSettings((s) => s.deployMode);
  const deployWallet = useXMonitorSettings((s) => s.deployWallet);
  const deployWalletKey = useXMonitorSettings((s) => s.deployWalletKey);
  const signerLabel = deployWalletKey
    ? 'your custom wallet'
    : deployWallet
      ? `${deployWallet.slice(0, 4)}…${deployWallet.slice(-4)}`
      : 'your connected wallet';
  const [tonConnectUI] = useTonConnectUI();
  const tonWallet = useTonWallet();
  const { deploySol, deployEvm } = useClientLaunch();
  const { mounted, visible } = useOverlayPresence(open, OVERLAY_ANIM_CLOSE_MS);

  const [deploying, setDeploying] = useState(false);

  const handleDeploy = async () => {
    const d = useLaunchModalStore.getState().draft;
    if (!d || deploying) return;
    if (!d.name.trim() || !d.symbol.trim()) {
      toast.error('Add a name and ticker before deploying.');
      return;
    }
    const ticker = d.symbol.replace(/^\$/, '').toUpperCase();

    // TON launches deploy from the user's own TonConnect wallet (client-side),
    // not a server burner — TON is the "your wallet is the deploy wallet" chain.
    if (d.chain === 'ton') {
      if (!tonWallet?.account?.address) {
        toast.error('Connect your TON wallet first (chain switcher → TON).');
        return;
      }
      setDeploying(true);
      const tt = toast.loading(`Launching $${ticker} on TON — approve in your wallet…`);
      try {
        const { deployTonJetton } = await import('@/lib/launch/deployTonJetton');
        const { jettonAddress } = await deployTonJetton(tonConnectUI, {
          name: d.name,
          symbol: ticker,
          description: d.description,
          imageUrl: d.imageUrls?.[0] ?? null,
          ownerAddress: tonWallet.account.address,
        });
        toast.success(`Launched $${ticker} on TON!`, {
          id: tt,
          description: `${jettonAddress.slice(0, 6)}…${jettonAddress.slice(-4)}`,
          action: { label: 'Open', onClick: () => window.open(`https://tonviewer.com/${jettonAddress}`, '_blank', 'noopener,noreferrer') },
        });
        close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'ton_deploy_failed';
        toast.error(/reject|cancel|declin/i.test(msg) ? 'Deploy cancelled.' : 'TON deploy failed — try again.', { id: tt });
      } finally {
        setDeploying(false);
      }
      return;
    }

    // Solana launches deploy from the user's OWN wallet (client-side, Privy
    // sign-only) — same "your main wallet is the deploy wallet" model as TON.
    // The server only assembles the unsigned pump.fun/bonk tx; no server key.
    if (d.chain === 'sol') {
      setDeploying(true);
      const tt = toast.loading(`Launching $${ticker} on Solana — approve in your wallet…`);
      try {
        const { mint } = await deploySol({
          name: d.name,
          symbol: ticker,
          description: d.description,
          imageUrl: d.imageUrls?.[0] ?? null,
          twitter: d.twitterUrl ?? d.tweetUrl ?? null,
          website: d.website ?? null,
          launchpad: d.launchpad,
          devBuyNative: d.launchBuySol,
        });
        toast.success(`Launched $${ticker} on Solana!`, {
          id: tt,
          description: `${mint.slice(0, 4)}…${mint.slice(-4)}`,
          action: { label: 'Open', onClick: () => window.open(`https://solscan.io/token/${mint}`, '_blank', 'noopener,noreferrer') },
        });
        close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'sol_deploy_failed';
        const friendly = /reject|cancel|declin/i.test(msg)
          ? 'Deploy cancelled.'
          : /\s/.test(msg)
            ? msg // friendly server message (e.g. "moonshot isn’t wired… pick pump.fun")
            : 'Solana deploy failed — try again.';
        toast.error(friendly, { id: tt });
      } finally {
        setDeploying(false);
      }
      return;
    }

    // EVM launches (ETH / Base / BNB) deploy from the user's OWN wallet too —
    // Privy EVM wallet → viem → clanker factory (verified). Same model as SOL/TON.
    if (d.chain === 'eth' || d.chain === 'bnb' || d.chain === 'base') {
      setDeploying(true);
      const tt = toast.loading(`Launching $${ticker} on ${d.chain.toUpperCase()} — approve in your wallet…`);
      try {
        const { tokenAddress, explorerUrl } = await deployEvm(d.chain, {
          name: d.name,
          symbol: ticker,
          description: d.description,
          imageUrl: d.imageUrls?.[0] ?? null,
          twitter: d.twitterUrl ?? d.tweetUrl ?? null,
          website: d.website ?? null,
          launchpad: d.launchpad,
        });
        toast.success(`Launched $${ticker} on ${d.chain.toUpperCase()}!`, {
          id: tt,
          description: `${tokenAddress.slice(0, 6)}…${tokenAddress.slice(-4)}`,
          action: { label: 'Open', onClick: () => window.open(explorerUrl, '_blank', 'noopener,noreferrer') },
        });
        close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'evm_deploy_failed';
        const friendly = /reject|cancel|declin|denied/i.test(msg)
          ? 'Deploy cancelled.'
          : /\s/.test(msg)
            ? msg // friendly message (e.g. "four.meme isn’t wired… pick clanker")
            : `${d.chain.toUpperCase()} deploy failed — try again.`;
        toast.error(friendly, { id: tt });
      } finally {
        setDeploying(false);
      }
      return;
    }
  };

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Opened from a suggestion's N/T badge → focus + select that field for a quick edit.
  const focusField = draft?.focusField ?? null;
  useEffect(() => {
    if (!open || !focusField) return;
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>(`[data-launch-field="${focusField}"]`);
      el?.focus();
      el?.select();
    }, 60);
    return () => clearTimeout(t);
  }, [open, focusField]);

  if (!mounted || !draft) return null;

  const inputCls =
    'w-full rounded-sm border border-white/[0.08] bg-bg-sunken px-2.5 py-2 text-[12px] text-fg-primary outline-none focus:border-accent-primary/40';

  const sidePanel = deployMode === 'sidePanel';

  return (
    <div
      className={cn(
        'fixed inset-0 flex',
        sidePanel ? 'items-stretch justify-end' : 'items-center justify-center',
        Z_APP_MODAL_OVERLAY,
      )}
    >
      <button
        type="button"
        aria-label="Close launch modal"
        className={cn(
          'absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm',
          overlayBackdropClasses(visible),
        )}
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="launch-modal-title"
        className={cn(
          'relative z-10 flex flex-col overflow-hidden border border-border-subtle bg-bg-raised shadow-2xl',
          sidePanel
            ? 'h-full w-full max-w-md rounded-none border-y-0 border-r-0'
            : 'mx-3 max-h-[90vh] w-full max-w-lg rounded-sm',
          overlayPanelClasses(visible),
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border-subtle px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-accent-primary/12 text-accent-primary">
                <Rocket className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h2 id="launch-modal-title" className="text-sm font-semibold text-fg-primary">
                  Launch token
                </h2>
                <p className="text-[10px] text-fg-muted">AI pre-fill · on-chain deploy coming soon</p>
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-[10px] leading-snug text-fg-muted">
              @{draft.authorHandle.replace(/^@/, '')} · {draft.tweetText.slice(0, 120)}
              {draft.tweetText.length > 120 ? '…' : ''}
            </p>
          </div>
          <CloseButton onClick={close} size="lg" />
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 flex items-center justify-between text-[10px] font-medium text-fg-muted">
                <span>Name</span>
                <span className="tabular-nums">{draft.name.length}/32</span>
              </span>
              <input
                data-launch-field="name"
                className={inputCls}
                value={draft.name}
                maxLength={32}
                placeholder="Token name"
                onChange={(e) => patchDraft({ name: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 flex items-center justify-between text-[10px] font-medium text-fg-muted">
                <span>Ticker</span>
                <span className="tabular-nums">{draft.symbol.length}/10</span>
              </span>
              <input
                data-launch-field="ticker"
                className={cn(inputCls, 'uppercase')}
                value={draft.symbol}
                maxLength={10}
                placeholder="TICKER"
                onChange={(e) =>
                  patchDraft({ symbol: e.target.value.replace(/^\$/, '').toUpperCase() })
                }
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px] font-medium text-fg-muted">Description</span>
            <textarea
              className={cn(inputCls, 'min-h-[72px] resize-y')}
              value={draft.description}
              maxLength={500}
              onChange={(e) => patchDraft({ description: e.target.value })}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-fg-muted">Website (optional)</span>
              <input
                className={inputCls}
                value={draft.website ?? ''}
                placeholder="https://…"
                onChange={(e) => patchDraft({ website: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-fg-muted">X / Twitter</span>
              <input
                className={inputCls}
                value={draft.twitterUrl ?? draft.tweetUrl ?? `https://x.com/${draft.authorHandle.replace(/^@/, '')}`}
                placeholder="https://x.com/…"
                onChange={(e) => patchDraft({ twitterUrl: e.target.value })}
              />
            </label>
          </div>

          <div className={draft.chain === 'ton' ? 'hidden' : undefined}>
            <span className="mb-1 block text-[10px] font-medium text-fg-muted">Launchpad</span>
            <div className="flex flex-wrap gap-1.5">
              {launchpadsForChain(draft.chain).map((id) => {
                const brand = protocolBrand(id);
                const active = draft.launchpad === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => patchDraft({ launchpad: id as LaunchPackageLaunchpad })}
                    className={cn(
                      'flex items-center gap-1 rounded-sm border px-2 py-1 text-[10px] font-semibold transition',
                      active
                        ? 'border-accent-primary/40 bg-accent-primary/12 text-accent-primary'
                        : 'border-border-subtle text-fg-muted hover:bg-bg-hover',
                    )}
                  >
                    <ProtocolBrandIcon protocolId={id} dotClassName="h-3.5 w-3.5" />
                    {brand?.label ?? id}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px] font-medium text-fg-muted">Image</span>
            <select
              className={inputCls}
              value={draft.imageStrategy}
              onChange={(e) =>
                patchDraft({
                  imageStrategy: e.target.value as typeof draft.imageStrategy,
                })
              }
            >
              <option value="use_tweet_image">Use tweet image</option>
              <option value="generate">Generate later</option>
              <option value="no_image">No image</option>
            </select>
            {draft.imageStrategy === 'use_tweet_image' && draft.imageUrls[0] ? (
              <img
                src={draft.imageUrls[0]}
                alt=""
                className="mt-2 h-16 w-16 rounded-sm border border-border-subtle object-cover"
                referrerPolicy="no-referrer"
              />
            ) : null}
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-medium text-fg-muted">Dev buy (SOL)</span>
            <input
              type="number"
              min={0}
              max={50}
              step={0.01}
              className={inputCls}
              value={draft.launchBuySol}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) patchDraft({ launchBuySol: n });
              }}
            />
            <div className="mt-1.5 flex gap-1.5">
              {[0.5, 1, 2, 5].map((amt) => {
                const active = draft.launchBuySol === amt;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => patchDraft({ launchBuySol: amt })}
                    className={cn(
                      'btn-press flex-1 rounded-sm py-1 text-[11px] font-semibold tabular-nums transition-colors',
                      active
                        ? 'bg-accent-primary/25 text-accent-primary'
                        : 'bg-accent-primary/[0.08] text-fg-muted hover:bg-accent-primary/15 hover:text-accent-primary',
                    )}
                  >
                    {amt}
                  </button>
                );
              })}
            </div>
          </label>

          <DeployFeatures
            features={draft.features ?? DEFAULT_LAUNCH_FEATURES}
            onChange={(patch) =>
              patchDraft({ features: { ...(draft.features ?? DEFAULT_LAUNCH_FEATURES), ...patch } })
            }
          />

          {draft.reasoning ? (
            <p className="rounded-sm border border-accent-primary/20 bg-accent-primary/8 px-2.5 py-2 text-[10px] leading-snug text-fg-secondary">
              <span className="font-semibold text-accent-primary">
                AI {Math.round(draft.confidence * 100)}% ·{' '}
              </span>
              {draft.reasoning}
            </p>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-border-subtle px-4 py-3">
          <button
            type="button"
            onClick={handleDeploy}
            disabled={deploying}
            title={`Deploy $${draft.symbol.replace(/^\$/, '').toUpperCase() || 'token'} on ${draft.chain.toUpperCase()}`}
            className={cn(
              'btn-press flex w-full items-center justify-center gap-2 rounded-sm border border-accent-primary/40 bg-accent-primary/20 py-2.5 text-[12px] font-semibold text-accent-primary',
              'transition-all duration-150 hover:-translate-y-0.5 hover:border-accent-primary/60 hover:bg-accent-primary/30',
              'hover:shadow-[0_6px_18px_-6px_rgb(var(--pulse-accent-rgb)/0.5)] active:translate-y-0',
              'disabled:pointer-events-none disabled:opacity-60',
            )}
          >
            {deploying ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} /> Launching…
              </>
            ) : (
              <>
                <Rocket className="h-3.5 w-3.5" strokeWidth={2.5} /> Deploy on {draft.chain.toUpperCase()}
              </>
            )}
          </button>
          <p className="mt-2 text-center text-[9px] text-fg-muted">
            Signs with <span className="text-fg-secondary">{signerLabel}</span> ·{' '}
            <span className="text-fg-secondary tabular-nums">{draft.launchBuySol || defaultBuySol}</span>{' '}
            {draft.chain === 'sol' ? 'SOL' : draft.chain === 'bnb' ? 'BNB' : draft.chain === 'ton' ? 'TON' : 'ETH'} dev buy ·{' '}
            <span className="uppercase text-fg-secondary">{feePreset}</span> fee
          </p>
        </footer>
      </div>
    </div>
  );
}

/** Small pill toggle used inside the feature cards. */
function FeatureToggle({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-4 w-7 shrink-0 items-center rounded-full px-0.5 transition-colors',
        on ? 'bg-accent-primary/80' : 'bg-white/[0.14]',
      )}
    >
      <span
        className={cn(
          'inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform',
          on ? 'translate-x-3' : 'translate-x-0',
        )}
      />
    </span>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-sm border border-white/[0.1] bg-bg-sunken px-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="btn-press px-1.5 text-[13px] font-bold text-fg-muted hover:text-fg-primary"
      >
        −
      </button>
      <span className="w-4 text-center text-[12px] font-semibold tabular-nums text-fg-primary">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="btn-press px-1.5 text-[13px] font-bold text-fg-muted hover:text-fg-primary"
      >
        +
      </button>
    </div>
  );
}

type FeatureDef = {
  key: keyof LaunchFeatures;
  label: string;
  desc: string;
  icon: typeof Zap;
};

const FEATURE_DEFS: FeatureDef[] = [
  { key: 'cashback', label: 'Cashback', desc: '50% of creator fees back to you', icon: BadgePercent },
  { key: 'mayhem', label: 'Mayhem', desc: 'Aggressive volume + auto-boosts', icon: Zap },
  { key: 'tasks', label: 'Tasks', desc: 'Attach community quests to the page', icon: ListChecks },
  { key: 'feeSplit', label: 'Fee split', desc: 'Route a share of fees to a wallet', icon: Split },
  { key: 'multi', label: 'Multi-wallet', desc: 'Spread the dev buy for organic look', icon: Users },
  { key: 'bundle', label: 'Bundle', desc: 'Jito-bundle the buy · anti-snipe', icon: Layers },
];

function DeployFeatures({
  features,
  onChange,
}: {
  features: LaunchFeatures;
  onChange: (patch: Partial<LaunchFeatures>) => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[10px] font-medium text-fg-muted">Advanced</span>
      <div className="grid grid-cols-2 gap-1.5">
        {FEATURE_DEFS.map((f) => {
          const on = Boolean(features[f.key]);
          const Icon = f.icon;
          return (
            <div
              key={f.key}
              className={cn(
                'rounded-sm border transition-colors',
                on ? 'border-accent-primary/40 bg-accent-primary/[0.07]' : 'border-border-subtle bg-bg-sunken/40',
              )}
            >
              <button
                type="button"
                onClick={() => onChange({ [f.key]: !on } as Partial<LaunchFeatures>)}
                className="flex w-full items-center gap-2 px-2 py-2 text-left"
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-sm',
                    on ? 'bg-accent-primary/20 text-accent-primary' : 'bg-white/[0.05] text-fg-muted',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold text-fg-primary">{f.label}</span>
                  <span className="block truncate text-[9.5px] leading-tight text-fg-muted">{f.desc}</span>
                </span>
                <FeatureToggle on={on} />
              </button>

              {on && f.key === 'feeSplit' ? (
                <div className="space-y-1.5 border-t border-white/[0.06] px-2 py-2">
                  <input
                    value={features.feeSplitWallet}
                    onChange={(e) => onChange({ feeSplitWallet: e.target.value.trim() })}
                    placeholder="Wallet address"
                    className="w-full rounded-sm border border-white/[0.08] bg-bg-sunken px-2 py-1 font-mono text-[10px] text-fg-primary outline-none focus:border-accent-primary/40"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-fg-muted">Split {features.feeSplitPct}%</span>
                    <input
                      type="range"
                      min={5}
                      max={95}
                      step={5}
                      value={features.feeSplitPct}
                      onChange={(e) => onChange({ feeSplitPct: Number(e.target.value) })}
                      className="h-1 flex-1 accent-accent-primary"
                    />
                  </div>
                </div>
              ) : null}

              {on && f.key === 'multi' ? (
                <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-2 py-2">
                  <span className="text-[10px] text-fg-muted">Wallets</span>
                  <Stepper
                    value={features.multiWallets}
                    min={2}
                    max={20}
                    onChange={(n) => onChange({ multiWallets: n })}
                  />
                </div>
              ) : null}

              {on && f.key === 'bundle' ? (
                <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-2 py-2">
                  <span className="text-[10px] text-fg-muted">Bundle wallets</span>
                  <Stepper
                    value={features.bundleWallets}
                    min={2}
                    max={20}
                    onChange={(n) => onChange({ bundleWallets: n })}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
