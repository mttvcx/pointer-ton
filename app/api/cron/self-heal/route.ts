import type { NextRequest } from 'next/server';
import { runAuthorizedCron } from '@/lib/ingest/cronRoute';
import { runSelfHealCycle } from '@/lib/ops/selfHeal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Autonomous self-heal cycle. Observe-only unless SELFHEAL_ENABLED=1; even then
 *  only SAFE actions auto-run, dangerous ones escalate. */
export async function GET(req: NextRequest) {
  return runAuthorizedCron(req, async () => runSelfHealCycle(), { revalidatePulse: false });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
