import { classifyTweetIntentHeuristic } from '@/lib/track/automation/classifyIntent';
import { matchSignalsToPulseRows } from '@/lib/track/automation/matchPulse';
import { parseTweetDeterministicSignals } from '@/lib/track/automation/parseTweetSignals';
import type {
  AutomationFailureReason,
  AutomationGlobalSettings,
  AutomationPipelineResult,
  AutomationTriggerType,
  MatchedPulseToken,
  ParsedTweetSignals,
  StoredAutomationRule,
  TweetIngestInput,
} from '@/lib/track/automation/types';
import type { PulseTokenBundle } from '@/types/tokens';

const AUTO_BUY_MIN_CONF01 = 0.52;

const LAUNCHPAD_URL_FRAGMENT = /\b(pump\.fun|dexscreener|birdeye|moonshot|axiom\.trade)\b/i;

export function normalizeXHandle(raw: string): string {
  return raw.replace(/^@/, '').trim().toLowerCase();
}

function keywordHit(text: string, keywords: string[], mode: StoredAutomationRule['keywordMatch']): boolean {
  if (keywords.length === 0) return false;
  const lower = text.toLowerCase();
  for (const k of keywords) {
    const kk = k.trim().toLowerCase();
    if (!kk) continue;
    if (mode === 'whole_word') {
      const re = new RegExp(`\\b${escapeRegExp(kk)}\\b`, 'i');
      if (re.test(lower)) return true;
    } else if (lower.includes(kk)) return true;
  }
  return false;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Signals actually present in tweet text regardless of UI toggles.
 */
function detectAllTriggers(opts: {
  event: TweetIngestInput;
  signals: ParsedTweetSignals;
  classificationBucket: AutomationPipelineResult['classification']['bucket'];
  pulseHits: MatchedPulseToken[];
  rule: StoredAutomationRule;
}): AutomationTriggerType[] {
  const { event, signals, classificationBucket, pulseHits, rule } = opts;
  const hit = new Set<AutomationTriggerType>();

  const block = `${event.text}\n${(event.urls ?? []).join('\n')}`;

  const roster = rule.handles.map(normalizeXHandle).filter(Boolean);
  const authorOk = roster.length === 0 || roster.includes(normalizeXHandle(event.handle));
  if (authorOk) {
    hit.add('tweet_from_handle');
  }

  if (signals.contracts.length > 0) hit.add('contains_contract_address');

  const tickMatches =
    signals.tickers.length > 0 ||
    Boolean(
      (() => {
        const sym = rule.tickerSymbol?.trim();
        return sym ? signals.tickers.some((x) => x === sym.toUpperCase()) : false;
      })(),
    );
  if (tickMatches) hit.add('contains_ticker');

  if (signals.urls.some((u) => LAUNCHPAD_URL_FRAGMENT.test(u))) hit.add('launch_link');

  if (rule.keywords.length && keywordHit(block, rule.keywords, rule.keywordMatch)) hit.add('keywords');

  if (classificationBucket !== 'irrelevant') hit.add('ai_semantic_intent');

  if (pulseHits.length > 0) hit.add('pulse_visible_token');

  if (signals.launchVerbosityScore > 0.45 || classificationBucket === 'launch_announcement') {
    hit.add('fresh_launch_style');
  }

  return [...hit];
}

function gateAutoBuy(opts: {
  rule: StoredAutomationRule;
  global: AutomationGlobalSettings;
  triggersHit: AutomationTriggerType[];
  compositeConfidence01: number;
  hasDeterministicMint: boolean;
}): AutomationFailureReason | null {
  const { rule, global, triggersHit, compositeConfidence01, hasDeterministicMint } = opts;

  if (rule.executionMode !== 'auto_buy') return null;

  if (global.killSwitchActive) return 'global_kill_switch';
  if (!global.automationEnabledUi) return 'automation_disabled';

  if (triggersHit.length === 0) return 'no_token_detected';

  if (
    compositeConfidence01 < AUTO_BUY_MIN_CONF01 &&
    !hasDeterministicMint &&
    !triggersHit.includes('contains_contract_address')
  ) {
    return 'low_confidence';
  }

  return null;
}

function summarize(opts: {
  handle: string;
  signals: ParsedTweetSignals;
  rule: StoredAutomationRule;
  intent: AutomationPipelineResult['classification'];
  triggersHit: AutomationTriggerType[];
}): string {
  const ca = opts.signals.contracts[0];
  const tick = opts.signals.tickers[0];
  const who = `@${normalizeXHandle(opts.handle)}`;
  const topic = tick ?? opts.rule.tickerSymbol ?? (ca ? shorten(ca) : 'token unclear');
  return `${who} fired “${opts.rule.name}”: ${topic} • ${opts.intent.bucket} (${(opts.intent.confidence01 * 100).toFixed(0)}%) • triggers: ${opts.triggersHit.join(', ') || '—'}`;
}

function shorten(ca: string): string {
  if (ca.length < 14) return ca;
  return `${ca.slice(0, 6)}…${ca.slice(-4)}`;
}

export function evaluateAutomationPipeline(input: {
  event: TweetIngestInput;
  rules: StoredAutomationRule[];
  globalSettings: AutomationGlobalSettings;
  pulseBundles: PulseTokenBundle[];
}): AutomationPipelineResult {
  const normalizedHandle = normalizeXHandle(input.event.handle);
  const signals = parseTweetDeterministicSignals(input.event.text, input.event.urls);
  const classification = classifyTweetIntentHeuristic(input.event.text, signals);

  const pulseHits = matchSignalsToPulseRows(signals, input.pulseBundles);

  const decisions = input.rules.flatMap((rule): AutomationPipelineResult['decisions'] => {
    if (!rule.enabled) {
      return [
        {
          rule,
          triggersHit: [],
          wouldFire: false,
          blockedReason: 'rule_disabled' as AutomationFailureReason,
          alertSummaryLine: summarize({ handle: input.event.handle, signals, rule, intent: classification, triggersHit: [] }),
          compositeConfidence01: classification.confidence01,
        },
      ];
    }

    const detected = detectAllTriggers({
      event: input.event,
      signals,
      classificationBucket: classification.bucket,
      pulseHits,
      rule,
    });
    const triggersHit = detected.filter((tg) => rule.triggersEnabled[tg]);

    const mintCandidate =
      rule.fixedMintCa?.trim() ||
      pulseHits[0]?.mint ||
      signals.contracts[0] ||
      null;
    const hasDeterministicMint = Boolean(mintCandidate);

    const compositeConfidence01 = Math.min(
      1,
      Math.max(
        classification.confidence01,
        signals.contracts.length > 0 ? 0.92 : 0,
        pulseHits.length > 0 ? 0.82 : 0,
        triggersHit.includes('keywords') ? 0.62 : 0,
        triggersHit.includes('fresh_launch_style') ? 0.58 : 0,
      ),
    );

    let blockedReason: AutomationFailureReason | null = gateAutoBuy({
      rule,
      global: input.globalSettings,
      triggersHit,
      compositeConfidence01,
      hasDeterministicMint:
        hasDeterministicMint || triggersHit.includes('contains_contract_address'),
    });

    const shouldConsider = triggersHit.length > 0;
    const summary = summarize({
      handle: input.event.handle,
      signals,
      rule,
      intent: classification,
      triggersHit,
    });

    if (!shouldConsider) {
      return [
        {
          rule,
          triggersHit,
          wouldFire: false,
          blockedReason,
          alertSummaryLine: summary,
          compositeConfidence01,
        },
      ];
    }

    const wouldAttemptAutoBuy =
      rule.executionMode === 'auto_buy' && mintCandidate !== null && blockedReason === null;

    const needsMintForOneClick =
      rule.executionMode === 'one_click' && mintCandidate === null ? ('no_token_detected' as const) : null;
    /** one-click surfaces UI even without mint sometimes — still notify */

    const wouldFireAlert =
      shouldConsider &&
      (rule.executionMode === 'alert_only' ||
        rule.executionMode === 'one_click' ||
        wouldAttemptAutoBuy);

    let finalBlocked = blockedReason;
    if (
      rule.executionMode === 'one_click' &&
      needsMintForOneClick &&
      !signals.contracts.length &&
      pulseHits.length === 0 &&
      !rule.fixedMintCa
    ) {
      finalBlocked = 'no_token_detected';
    }

    return [
      {
        rule,
        triggersHit,
        wouldFire: wouldFireAlert || wouldAttemptAutoBuy,
        blockedReason: wouldAttemptAutoBuy ? blockedReason : finalBlocked,
        alertSummaryLine: summary,
        compositeConfidence01,
      },
    ];
  });

  return {
    event: input.event,
    normalizedHandle,
    signals,
    classification,
    pulseHits,
    decisions,
  };
}
