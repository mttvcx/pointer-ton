'use client';

import { useMemo, useState } from 'react';
import {
  AUTOMATION_ACTION_TYPES,
  AUTOMATION_TRIGGER_TYPES,
  DEFAULT_ACTIVITY_FILTER,
  actionTypeLabel,
  triggerTypeLabel,
  type ActivityFilter,
  type AutomationActionType,
  type AutomationTriggerType,
} from '@/lib/alerts/automationRuleModel';
import type { TweetImageMintMode } from '@/lib/alerts/alertRuleModel';
import { ImageMatchTriggerFields } from '@/components/alerts/ImageMatchTriggerFields';
import {
  HAMMING_THRESHOLD_PRESETS,
  normalizeImageHashHex,
  type HammingThresholdPreset,
} from '@/lib/image/perceptualHash';
import { normalizeTwitterHandle } from '@/lib/alerts/solMintFromText';
import { cn } from '@/lib/utils/cn';
import { TerminalCheckbox } from '@/components/ui/TerminalCheckbox';
import { useAutoLaunchStore } from '@/store/autoLaunch';
import { defaultLaunchpadForChain, launchpadsForChain } from '@/lib/launch/types';
import type { LaunchChain } from '@/lib/alerts/automationRuleModel';

/** Chains an auto-launch rule can fire on server-side (TON is manual-only). */
const AUTO_LAUNCH_CHAINS: readonly Exclude<LaunchChain, 'ton'>[] = ['sol', 'eth', 'base', 'bnb'];

export type AutomationRuleDraft = {
  name: string;
  triggerType: AutomationTriggerType;
  triggerConfig: Record<string, unknown>;
  actionType: AutomationActionType;
  actionConfig: Record<string, unknown>;
  activityFilter: ActivityFilter;
  disableAfterSuccess: boolean;
  cooldownSeconds: number;
  dailyCapSol: string;
};

const TWITTER_TRIGGERS: AutomationTriggerType[] = [
  'keyword',
  'ca_detected',
  'image_match',
  'interaction',
  'pfp_change',
  'banner_change',
];

const UI = {
  border: 'rgba(255, 255, 255, 0.1)',
  elevated: 'rgba(255, 255, 255, 0.07)',
  muted: '#9ba3b0',
  text: '#f0f4fc',
} as const;

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
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

function parseHandles(raw: string): string[] {
  const parts = raw
    .split(/[\s,]+/)
    .map((s) => normalizeTwitterHandle(s.trim()))
    .filter(Boolean);
  return [...new Set(parts)];
}

function parsePhrases(raw: string): string[] {
  return [...new Set(raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean))].slice(0, 64);
}

export function defaultAutomationDraft(): AutomationRuleDraft {
  return {
    name: '',
    triggerType: 'keyword',
    triggerConfig: { handles: [], phrases: [], phraseMatch: 'substring' },
    actionType: 'notify',
    actionConfig: { openWithTweetMedia: true, tweetImageMintMode: 'smart' },
    activityFilter: { ...DEFAULT_ACTIVITY_FILTER },
    disableAfterSuccess: false,
    cooldownSeconds: 0,
    dailyCapSol: '',
  };
}

export function automationDraftToBody(draft: AutomationRuleDraft) {
  const handles = parseHandles(String(draft.triggerConfig.handlesRaw ?? ''));
  if (handles.length === 0) {
    throw new Error('Add at least one X handle');
  }

  let triggerConfig: Record<string, unknown>;
  switch (draft.triggerType) {
    case 'keyword': {
      const phrases = parsePhrases(String(draft.triggerConfig.phrasesRaw ?? ''));
      triggerConfig = {
        handles,
        phrases,
        phraseMatch: draft.triggerConfig.phraseMatch ?? 'substring',
      };
      break;
    }
    case 'ca_detected':
      triggerConfig = {
        handles,
        tweetImageMintMode: draft.triggerConfig.tweetImageMintMode ?? 'off',
      };
      break;
    case 'image_match':
      triggerConfig = {
        handles,
        tweetImageMintMode: draft.triggerConfig.tweetImageMintMode ?? 'smart',
        openWithTweetMedia: draft.triggerConfig.openWithTweetMedia !== false,
      };
      break;
    case 'interaction':
      triggerConfig = {
        handles,
        kinds: draft.triggerConfig.kinds ?? ['reply', 'quote'],
      };
      break;
    case 'pfp_change':
    case 'banner_change':
      triggerConfig = { handles };
      break;
    case 'mc_milestone':
      triggerConfig = {
        targetMcUsd: Number(draft.triggerConfig.targetMcUsd) || 1_000_000,
        ...(draft.triggerConfig.mint ? { mint: String(draft.triggerConfig.mint).trim() } : {}),
      };
      break;
    case 'time_elapsed':
      triggerConfig = {
        minutes: Number(draft.triggerConfig.minutes) || 30,
        ...(draft.triggerConfig.mint ? { mint: String(draft.triggerConfig.mint).trim() } : {}),
      };
      break;
    default:
      triggerConfig = { handles };
  }

  let actionConfig: Record<string, unknown> = {};
  if (draft.actionType === 'buy') {
    const buy = draft.actionConfig.buySolPreset;
    const buyParsed = buy === '' || buy == null ? null : Number(buy);
    actionConfig = {
      buySolPreset:
        buyParsed != null && Number.isFinite(buyParsed) && buyParsed > 0 ? buyParsed : null,
      slippageBps: draft.actionConfig.slippageBps ?? null,
    };
  } else if (draft.actionType === 'sell') {
    actionConfig = {
      sellPct: Number(draft.actionConfig.sellPct) || 25,
    };
  } else if (draft.actionType === 'notify') {
    actionConfig = {
      openWithTweetMedia: draft.actionConfig.openWithTweetMedia !== false,
      tweetImageMintMode: draft.actionConfig.tweetImageMintMode ?? 'smart',
    };
  } else if (draft.actionType === 'deploy') {
    const launchPrefs = useAutoLaunchStore.getState();
    const chain = (AUTO_LAUNCH_CHAINS as readonly string[]).includes(String(draft.actionConfig.chain))
      ? (draft.actionConfig.chain as Exclude<LaunchChain, 'ton'>)
      : 'sol';
    const launchpad = draft.actionConfig.launchpad
      ? String(draft.actionConfig.launchpad)
      : defaultLaunchpadForChain(chain);
    actionConfig = {
      launchMode: launchPrefs.launchMode,
      launchBuySol: launchPrefs.launchBuySol,
      chain,
      launchpad,
    };
  }

  const daily =
    draft.dailyCapSol.trim() === '' ? null : Number(draft.dailyCapSol.trim());

  return {
    name: draft.name.trim(),
    triggerType: draft.triggerType,
    triggerConfig,
    actionType: draft.actionType,
    actionConfig,
    activityFilter: draft.activityFilter,
    disableAfterSuccess: draft.disableAfterSuccess,
    cooldownSeconds: Math.max(0, Math.floor(draft.cooldownSeconds)),
    dailyCapSol: daily != null && Number.isFinite(daily) && daily > 0 ? daily : null,
  };
}

type Props = {
  draft: AutomationRuleDraft;
  onChange: (patch: Partial<AutomationRuleDraft> | ((d: AutomationRuleDraft) => AutomationRuleDraft)) => void;
  inputCls: string;
  showPortfolioTriggers?: boolean;
  /** Dark terminal styling — fixes native select/checkbox glitches on Windows */
  terminal?: boolean;
};

export function AutomationRuleBuilder({
  draft,
  onChange,
  inputCls,
  showPortfolioTriggers = false,
  terminal = false,
}: Props) {
  const [handlesRaw, setHandlesRaw] = useState(() =>
    Array.isArray(draft.triggerConfig.handles)
      ? (draft.triggerConfig.handles as string[]).join(', ')
      : String(draft.triggerConfig.handlesRaw ?? ''),
  );
  const [phrasesRaw, setPhrasesRaw] = useState(() =>
    Array.isArray(draft.triggerConfig.phrases)
      ? (draft.triggerConfig.phrases as string[]).join('\n')
      : String(draft.triggerConfig.phrasesRaw ?? ''),
  );

  const triggerOptions = useMemo(() => {
    const base = TWITTER_TRIGGERS;
    if (showPortfolioTriggers) {
      return [...base, 'mc_milestone' as const, 'time_elapsed' as const];
    }
    return base;
  }, [showPortfolioTriggers]);

  const isTwitterTrigger = TWITTER_TRIGGERS.includes(draft.triggerType);

  function patchTrigger(patch: Record<string, unknown>) {
    onChange((d) => ({
      ...d,
      triggerConfig: { ...d.triggerConfig, ...patch },
    }));
  }

  function patchAction(patch: Record<string, unknown>) {
    onChange((d) => ({
      ...d,
      actionConfig: { ...d.actionConfig, ...patch },
    }));
  }

  function setActivity(key: keyof ActivityFilter, v: boolean) {
    onChange((d) => ({
      ...d,
      activityFilter: { ...d.activityFilter, [key]: v },
    }));
  }

  const selectCls = cn(inputCls, 'terminal-select py-2 text-[12px]');
  const fieldStyle = terminal
    ? undefined
    : ({ borderColor: UI.border, backgroundColor: UI.elevated, color: UI.text } as const);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <FieldLabel>Trigger type</FieldLabel>
        <select
          value={draft.triggerType}
          onChange={(e) => {
            const t = e.target.value as AutomationTriggerType;
            const base: Record<string, unknown> = { handlesRaw };
            if (t === 'keyword') Object.assign(base, { phrasesRaw, phraseMatch: 'substring' });
            if (t === 'image_match')
              Object.assign(base, {
                thresholdPreset: 'normal',
                targetImageHash: '',
                tweetImageMintMode: 'smart',
                openWithTweetMedia: true,
              });
            if (t === 'ca_detected') Object.assign(base, { tweetImageMintMode: 'off' });
            onChange({ triggerType: t, triggerConfig: base });
          }}
          className={selectCls}
          style={fieldStyle}
        >
          {triggerOptions.map((t) => (
            <option key={t} value={t}>
              {triggerTypeLabel(t)}
            </option>
          ))}
        </select>
      </div>

      {isTwitterTrigger ? (
        <div className="space-y-1.5">
          <FieldLabel hint="@optional — comma or space">Handles</FieldLabel>
          <textarea
            value={handlesRaw}
            onChange={(e) => {
              setHandlesRaw(e.target.value);
              patchTrigger({ handlesRaw: e.target.value });
            }}
            rows={2}
            placeholder="elonmusk, solana"
            className={cn(inputCls, 'min-h-[2.75rem] resize-y text-[12px] leading-snug')}
            style={fieldStyle}
          />
        </div>
      ) : null}

      {draft.triggerType === 'keyword' ? (
        <>
          <div className="space-y-1.5">
            <FieldLabel hint="Empty = any post from handles">Phrases</FieldLabel>
            <textarea
              value={phrasesRaw}
              onChange={(e) => {
                setPhrasesRaw(e.target.value);
                patchTrigger({ phrasesRaw: e.target.value });
              }}
              rows={2}
              className={cn(inputCls, 'min-h-[2.75rem] resize-y text-[12px] leading-snug')}
              style={fieldStyle}
            />
          </div>
          <div className="space-y-1">
            <FieldLabel>Phrase match</FieldLabel>
            <select
              value={String(draft.triggerConfig.phraseMatch ?? 'substring')}
              onChange={(e) => patchTrigger({ phraseMatch: e.target.value })}
              className={selectCls}
              style={fieldStyle}
            >
              <option value="substring">Substring</option>
              <option value="whole_word">Whole word</option>
            </select>
          </div>
        </>
      ) : null}

      {draft.triggerType === 'image_match' ? (
        <ImageMatchTriggerFields
          targetImageHash={String(draft.triggerConfig.targetImageHash ?? '')}
          thresholdPreset={(draft.triggerConfig.thresholdPreset as HammingThresholdPreset) ?? 'normal'}
          previewUrl={typeof draft.triggerConfig.previewUrl === 'string' ? draft.triggerConfig.previewUrl : null}
          onChange={(patch) => patchTrigger(patch as Record<string, unknown>)}
          inputCls={inputCls}
        />
      ) : null}

      {draft.triggerType === 'ca_detected' && (
        <div className="space-y-1">
          <FieldLabel>Tweet media mint mode</FieldLabel>
          <select
            value={String(draft.triggerConfig.tweetImageMintMode ?? 'smart')}
            onChange={(e) =>
              patchTrigger({ tweetImageMintMode: e.target.value as TweetImageMintMode })
            }
            className={selectCls}
            style={fieldStyle}
          >
            <option value="off">Off (caption / links only)</option>
            <option value="smart">Smart</option>
            <option value="prefer_media">Prefer media</option>
          </select>
        </div>
      )}

      {draft.triggerType === 'mc_milestone' ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <FieldLabel>Target MC (USD)</FieldLabel>
            <input
              type="number"
              value={String(draft.triggerConfig.targetMcUsd ?? '')}
              onChange={(e) => patchTrigger({ targetMcUsd: e.target.value })}
              className={cn(inputCls, 'tabular-nums')}
              style={fieldStyle}
            />
          </label>
          <label className="space-y-1">
            <FieldLabel hint="Optional">Mint</FieldLabel>
            <input
              value={String(draft.triggerConfig.mint ?? '')}
              onChange={(e) => patchTrigger({ mint: e.target.value })}
              className={inputCls}
              style={fieldStyle}
            />
          </label>
        </div>
      ) : null}

      {draft.triggerType === 'time_elapsed' ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <FieldLabel>Minutes</FieldLabel>
            <input
              type="number"
              value={String(draft.triggerConfig.minutes ?? 30)}
              onChange={(e) => patchTrigger({ minutes: e.target.value })}
              className={cn(inputCls, 'tabular-nums')}
              style={fieldStyle}
            />
          </label>
          <label className="space-y-1">
            <FieldLabel hint="Optional">Mint</FieldLabel>
            <input
              value={String(draft.triggerConfig.mint ?? '')}
              onChange={(e) => patchTrigger({ mint: e.target.value })}
              className={inputCls}
              style={fieldStyle}
            />
          </label>
        </div>
      ) : null}

      {isTwitterTrigger ? (
        <div
          className={cn(
            'space-y-1.5 rounded-sm border p-2.5',
            terminal
              ? 'border-white/[0.08] bg-bg-sunken/40'
              : 'rounded-xl border-white/[0.07] bg-white/[0.02]',
          )}
        >
          <p
            className={cn(
              'text-[10px] font-semibold uppercase tracking-wide',
              terminal ? 'text-fg-muted' : 'text-white/45',
            )}
          >
            Activity filter
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-fg-secondary">
            {(
              [
                ['tweets', 'Tweets'],
                ['replies', 'Replies'],
                ['quotes', 'Quotes'],
                ['retweets', 'Retweets'],
              ] as const
            ).map(([key, label]) =>
              terminal ? (
                <TerminalCheckbox
                  key={key}
                  checked={draft.activityFilter[key]}
                  onChange={(v) => setActivity(key, v)}
                  label={label}
                />
              ) : (
                <label key={key} className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={draft.activityFilter[key]}
                    onChange={(e) => setActivity(key, e.target.checked)}
                  />
                  {label}
                </label>
              ),
            )}
          </div>
        </div>
      ) : null}

      <div className="border-t border-white/[0.06] pt-3" />

      <div className="space-y-1.5">
        <FieldLabel>Action type</FieldLabel>
        <select
          value={draft.actionType}
          onChange={(e) => {
            const a = e.target.value as AutomationActionType;
            let actionConfig: Record<string, unknown> = {};
            if (a === 'notify') actionConfig = { openWithTweetMedia: true, tweetImageMintMode: 'smart' };
            if (a === 'buy') actionConfig = { buySolPreset: '' };
            if (a === 'sell') actionConfig = { sellPct: 25 };
            onChange({ actionType: a, actionConfig });
          }}
          className={selectCls}
          style={fieldStyle}
        >
          {AUTOMATION_ACTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {actionTypeLabel(t)}
            </option>
          ))}
        </select>
      </div>

      {draft.actionType === 'buy' ? (
        <div className="space-y-1.5">
          <FieldLabel hint="Empty = inherit quick-buy preset">SOL per buy</FieldLabel>
          <input
            value={String(draft.actionConfig.buySolPreset ?? '')}
            onChange={(e) => patchAction({ buySolPreset: e.target.value })}
            inputMode="decimal"
            placeholder="inherit"
            className={cn(inputCls, 'tabular-nums')}
            style={fieldStyle}
          />
        </div>
      ) : null}

      {draft.actionType === 'sell' ? (
        <div className="space-y-1.5">
          <FieldLabel>Sell % of holdings</FieldLabel>
          <input
            type="number"
            min={1}
            max={100}
            value={String(draft.actionConfig.sellPct ?? 25)}
            onChange={(e) => patchAction({ sellPct: e.target.value })}
            className={cn(inputCls, 'tabular-nums')}
            style={fieldStyle}
          />
        </div>
      ) : null}

      {draft.actionType === 'deploy'
        ? (() => {
            const deployChain = (AUTO_LAUNCH_CHAINS as readonly string[]).includes(
              String(draft.actionConfig.chain),
            )
              ? (draft.actionConfig.chain as Exclude<LaunchChain, 'ton'>)
              : 'sol';
            const deployPad = String(draft.actionConfig.launchpad ?? defaultLaunchpadForChain(deployChain));
            return (
              <div className="space-y-2">
                <p className="text-[10px] leading-snug text-fg-muted">
                  Fires automatically when Auto rules is on in X monitor. Uses AI launcher when that toggle
                  is on. Deploys on the chain + pad below — <span className="text-fg-secondary">regardless of
                  the chain you&apos;re viewing</span> when it fires.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <FieldLabel>Launch chain</FieldLabel>
                    <select
                      value={deployChain}
                      onChange={(e) => {
                        const ch = e.target.value as Exclude<LaunchChain, 'ton'>;
                        patchAction({ chain: ch, launchpad: defaultLaunchpadForChain(ch) });
                      }}
                      className={inputCls}
                      style={fieldStyle}
                    >
                      {AUTO_LAUNCH_CHAINS.map((ch) => (
                        <option key={ch} value={ch}>
                          {ch.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <FieldLabel>Launchpad</FieldLabel>
                    <select
                      value={deployPad}
                      onChange={(e) => patchAction({ launchpad: e.target.value })}
                      className={inputCls}
                      style={fieldStyle}
                    >
                      {launchpadsForChain(deployChain).map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            );
          })()
        : null}

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <FieldLabel>Cooldown (sec)</FieldLabel>
          <input
            type="number"
            min={0}
            value={draft.cooldownSeconds}
            onChange={(e) =>
              onChange({ cooldownSeconds: Math.max(0, Number(e.target.value) || 0) })
            }
            className={cn(inputCls, 'tabular-nums')}
            style={fieldStyle}
          />
        </label>
        <label className="space-y-1">
          <FieldLabel hint="Buy actions">Daily cap (SOL)</FieldLabel>
          <input
            value={draft.dailyCapSol}
            onChange={(e) => onChange({ dailyCapSol: e.target.value })}
            inputMode="decimal"
            placeholder="none"
            className={cn(inputCls, 'tabular-nums')}
            style={fieldStyle}
          />
        </label>
      </div>

      {terminal ? (
        <TerminalCheckbox
          checked={draft.disableAfterSuccess}
          onChange={(v) => onChange({ disableAfterSuccess: v })}
          label="Disable rule after first successful action"
          className="text-[11px] text-fg-secondary"
        />
      ) : (
        <label className="flex items-center gap-2 text-[11px] text-white/75">
          <input
            type="checkbox"
            checked={draft.disableAfterSuccess}
            onChange={(e) => onChange({ disableAfterSuccess: e.target.checked })}
          />
          Disable rule after first successful action
        </label>
      )}
    </div>
  );
}
