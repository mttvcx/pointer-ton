import 'server-only';

import type { DuneFacts, ProviderStatus } from '@/sibyl/data/providers/types';
import { sibylForceMock } from '@/sibyl/config';

/**
 * Dune — trading-terminal fee/volume dashboards (Axiom / Photon / Trojan / GMGN /
 * FOMO), bot market share, historical fee comparisons. Key-gated stub for MVP.
 * Env: DUNE_API_KEY. Point named queries via DUNE_QUERY_* ids (see CHECKLIST).
 */
// NOTE: real Dune query execution is not wired yet — flip REAL_IMPL when query ids land.
const REAL_IMPL = false;

export function duneStatus(): ProviderStatus {
  return {
    name: 'dune',
    configured: Boolean(process.env.DUNE_API_KEY?.trim()) && REAL_IMPL && !sibylForceMock(),
    envVars: ['DUNE_API_KEY'],
    note: REAL_IMPL ? 'Terminal fees/market share.' : 'Terminal fees/market share. Real queries pending (mock).',
  };
}

/** Answer a market/company question ("Axiom fees today"). Mock rows for now. */
export async function getTerminalFees(subject = 'axiom'): Promise<DuneFacts> {
  if (!REAL_IMPL || sibylForceMock() || !process.env.DUNE_API_KEY?.trim()) {
    return {
      title: `${subject[0]?.toUpperCase()}${subject.slice(1)} — 24h (sample)`,
      rows: [
        { label: 'Fees (24h)', value: '$412K' },
        { label: 'Volume (24h)', value: '$78.4M' },
        { label: 'Traders', value: '19,204' },
        { label: 'Market share', value: '31%' },
      ],
      queryUrl: null,
      source: 'dune:mock',
    };
  }
  // TODO: fetch executed Dune query results by id (DUNE_QUERY_AXIOM_FEES etc.).
  return { title: subject, rows: [], queryUrl: null, source: 'dune' };
}
