/**
 * Post-deploy / scheduled health probe. Hits the public liveness + status
 * endpoints and exits non-zero if the app is unreachable or reports maintenance.
 * Used by the deploy-health workflow and runnable locally:
 *
 *   POINTER_HEALTH_URL=https://app.example.com node --import tsx scripts/health-check.ts
 */
const base = (process.env.POINTER_HEALTH_URL || process.argv[2] || '').replace(/\/$/, '');
if (!base) {
  console.error('✗ no target URL (set POINTER_HEALTH_URL or pass it as the first arg)');
  process.exit(2);
}

const TIMEOUT_MS = 15_000;

async function getJson(path: string): Promise<{ status: number; body: unknown }> {
  const ctrl = AbortSignal.timeout(TIMEOUT_MS);
  const res = await fetch(`${base}${path}`, { signal: ctrl, headers: { accept: 'application/json' } });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-json */
  }
  return { status: res.status, body };
}

async function main() {
  const problems: string[] = [];

  // 1) Liveness — must be 200.
  try {
    const { status } = await getJson('/api/health');
    if (status !== 200) problems.push(`/api/health returned ${status}`);
    else console.log('✓ /api/health 200');
  } catch (err) {
    problems.push(`/api/health unreachable: ${err instanceof Error ? err.message : err}`);
  }

  // 2) Public status — surfaces maintenance / read-only so a probe can page.
  try {
    const { status, body } = await getJson('/api/emergency/status');
    if (status !== 200) {
      problems.push(`/api/emergency/status returned ${status}`);
    } else {
      const b = (body ?? {}) as { maintenance?: boolean; readOnly?: boolean };
      console.log(`✓ /api/emergency/status 200 (maintenance=${!!b.maintenance} readOnly=${!!b.readOnly})`);
      if (b.maintenance) problems.push('app reports MAINTENANCE mode');
    }
  } catch (err) {
    problems.push(`/api/emergency/status unreachable: ${err instanceof Error ? err.message : err}`);
  }

  if (problems.length > 0) {
    console.error(`\n✗ health check FAILED for ${base}:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`\n✓ health OK for ${base}`);
  process.exit(0);
}

void main();
