'use client';

import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { AppChainId } from '@/lib/chains/appChain';
import { evaluateAutomationPipeline } from '@/lib/track/automation/engine';
import type {
  AutomationGlobalSettings,
  AutomationHistoryEntry,
  AutomationTriggersState,
  StoredAutomationRule,
  TweetIngestInput,
} from '@/lib/track/automation/types';
import {
  DEFAULT_AUTOMATION_GLOBAL_SETTINGS,
  EMPTY_TRIGGER_DEFAULTS,
} from '@/lib/track/automation/types';
import type { PulseTokenBundle } from '@/types/tokens';

function isoNow(): string {
  return new Date().toISOString();
}

function defaultRiskPrefs(): StoredAutomationRule['riskPrefs'] {
  return {
    minLiquidityUsd: 2500,
    holderCountMin: 20,
    bundleRugCheck: true,
    mintRevoked: true,
    freezeRevoked: true,
    lpBondingStatusOk: true,
    duplicateDetection: true,
    deployerBlacklist: true,
    knownScamDeployer: true,
    honeypotRoutingCheck: true,
    maxTaxBps: 1200,
    topHolderConcentrationMax: 0.42,
    newDeployerWarning: true,
  };
}

export function cloneTriggers(): AutomationTriggersState {
  return { ...EMPTY_TRIGGER_DEFAULTS };
}

function seedDemoRules(chain: AppChainId): StoredAutomationRule[] {
  const t = isoNow();
  return [
    {
      id: nanoid(),
      category: 'alert',
      name: 'High signal — alert only',
      enabled: true,
      createdAtIso: t,
      updatedAtIso: t,
      handles: ['ansem', 'sol_b'],
      chainHint: chain,
      triggersEnabled: {
        ...cloneTriggers(),
        tweet_from_handle: true,
        contains_contract_address: true,
        launch_link: true,
      },
      executionMode: 'alert_only',
      executionTiming: 'precheck_then_buy',
      riskMode: 'strict',
      failureHandling: 'alert_only_after_failure',
      buySizeSol: null,
      slippageBps: 800,
      priorityFeeLamports: null,
      maxMarketCapUsd: null,
      minLiquidityUsdRule: null,
      cooldownMs: 90_000,
      maxBuysPerHour: 4,
      maxBuysPerDay: 40,
      keywords: [],
      keywordMatch: 'substring',
      semanticIntentHints: [],
      fixedMintCa: null,
      tickerSymbol: null,
      execWallet: { kind: 'active_primary' },
      riskPrefs: defaultRiskPrefs(),
    },
    {
      id: nanoid(),
      category: 'auto_buy',
      name: 'Power — CA in tweet (dry-run gated)',
      enabled: false,
      createdAtIso: t,
      updatedAtIso: t,
      handles: ['sol_a'],
      chainHint: chain,
      triggersEnabled: {
        ...cloneTriggers(),
        tweet_from_handle: true,
        contains_contract_address: true,
      },
      executionMode: 'auto_buy',
      executionTiming: 'instant_then_scan',
      riskMode: 'warn',
      failureHandling: 'retry_once',
      buySizeSol: 0.35,
      slippageBps: 1200,
      priorityFeeLamports: null,
      maxMarketCapUsd: 1_250_000,
      minLiquidityUsdRule: 4000,
      cooldownMs: 120_000,
      maxBuysPerHour: 2,
      maxBuysPerDay: 15,
      keywords: [],
      keywordMatch: 'substring',
      semanticIntentHints: [],
      fixedMintCa: null,
      tickerSymbol: null,
      execWallet: { kind: 'active_primary' },
      riskPrefs: defaultRiskPrefs(),
    },
    {
      id: nanoid(),
      category: 'auto_launch',
      name: 'Fresh launch phrase watch',
      enabled: false,
      createdAtIso: t,
      updatedAtIso: t,
      handles: [],
      chainHint: chain,
      triggersEnabled: {
        ...cloneTriggers(),
        fresh_launch_style: true,
        launch_link: true,
      },
      executionMode: 'one_click',
      executionTiming: 'precheck_then_buy',
      riskMode: 'strict',
      failureHandling: 'disable_rule_after_failures',
      buySizeSol: 0.2,
      slippageBps: 900,
      cooldownMs: 180_000,
      maxBuysPerHour: 3,
      maxBuysPerDay: 24,
      keywords: ['live', 'deploy'],
      keywordMatch: 'substring',
      semanticIntentHints: [],
      fixedMintCa: null,
      tickerSymbol: null,
      execWallet: { kind: 'active_primary' },
      riskPrefs: defaultRiskPrefs(),
    },
  ];
}

interface TrackAutomationStore {
  global: AutomationGlobalSettings;
  rules: StoredAutomationRule[];
  history: AutomationHistoryEntry[];

  bootstrapIfEmpty: (chain: AppChainId) => void;
  setGlobalPatch: (p: Partial<AutomationGlobalSettings>) => void;
  upsertRule: (rule: StoredAutomationRule) => void;
  removeRule: (id: string) => void;
  simulateTweet: (event: TweetIngestInput, pulseBundles: PulseTokenBundle[]) => AutomationHistoryEntry[];

  purgeHistory: () => void;
}

export const useTrackAutomationStore = create<TrackAutomationStore>()(
  persist(
    (set, get) => ({
      global: { ...DEFAULT_AUTOMATION_GLOBAL_SETTINGS },
      rules: [],
      history: [],

      bootstrapIfEmpty: (chain) => {
        if (get().rules.length > 0) return;
        set({ rules: seedDemoRules(chain) });
      },

      setGlobalPatch: (p) =>
        set((s) => ({
          global: { ...s.global, ...p },
        })),

      upsertRule: (rule) =>
        set((s) => ({
          rules: [...s.rules.filter((r) => r.id !== rule.id), rule],
        })),

      removeRule: (id) =>
        set((s) => ({
          rules: s.rules.filter((r) => r.id !== id),
        })),

      simulateTweet: (event, pulseBundles) => {
        const { global, rules } = get();
        const pipeline = evaluateAutomationPipeline({
          event,
          rules,
          globalSettings: global,
          pulseBundles,
        });

        const entries: AutomationHistoryEntry[] = [];

        for (const d of pipeline.decisions) {
          if (!d.triggersHit.length) continue;
          const mint =
            d.rule.fixedMintCa?.trim() ||
            pipeline.signals.contracts[0] ||
            pipeline.pulseHits[0]?.mint ||
            null;

          entries.push({
            id: nanoid(),
            atIso: isoNow(),
            handle: event.handle,
            tweetUrl: event.tweetUrl ?? null,
            tweetSnippet: event.text.slice(0, 240),
            detectedMint: mint,
            triggerTypes: d.triggersHit,
            aiConfidence01: pipeline.classification.confidence01,
            ruleId: d.rule.id,
            ruleName: d.rule.name,
            category: d.rule.category,
            modeAtFire: d.rule.executionMode,
            actionTaken: 'simulation',
            buySolPlanned: d.rule.buySizeSol ?? null,
            txSignature: null,
            result: d.blockedReason ? 'failed' : d.wouldFire ? 'ok' : 'skipped',
            failureReason: d.blockedReason,
            riskFlags:
              pipeline.signals.scamLikelihoodHint > 0.4 ? ['scam-language-heuristic'] : [],
            intentBucket: pipeline.classification.bucket,
          });
        }

        if (entries.length) {
          set((s) => ({
            history: [...entries, ...s.history].slice(0, 500),
          }));
        }

        return entries;
      },

      purgeHistory: () => set({ history: [] }),
    }),
    {
      name: 'pointer-track-automation-v1',
      partialize: (s) => ({
        global: s.global,
        rules: s.rules,
        history: s.history,
      }),
    },
  ),
);
