export * from '@/lib/track/automation/types';
export {
  classifyTweetIntentHeuristic,
} from '@/lib/track/automation/classifyIntent';
export {
  evaluateAutomationPipeline,
  normalizeXHandle,
} from '@/lib/track/automation/engine';
export { matchSignalsToPulseRows } from '@/lib/track/automation/matchPulse';
export { parseTweetDeterministicSignals } from '@/lib/track/automation/parseTweetSignals';
