#!/usr/bin/env node
// Post-deploy smoke test. Hits only PUBLIC endpoints (no auth/secrets) and asserts
// the deploy is alive and serving. Exits non-zero on any failure so it can gate a
// promotion / trip the deploy-health workflow.
//
//   node scripts/smoke-test.mjs https://app.example.com
//   npm run smoke -- https://app.example.com   (defaults to localhost:3001)

const base = (process.argv[2] || process.env.SMOKE_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 15000);

async function get(path) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}${path}`, { signal: ctrl.signal, headers: { 'user-agent': 'pointer-smoke/1' } });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-json is fine for some checks */ }
    return { status: res.status, json, text };
  } finally {
    clearTimeout(t);
  }
}

const checks = [
  {
    name: 'health (liveness)',
    run: async () => {
      const r = await get('/api/health');
      if (r.status !== 200) throw new Error(`status ${r.status}`);
      return r.json?.status ?? r.json?.ok ?? 'ok';
    },
  },
  {
    name: 'version (deploy identity)',
    run: async () => {
      const r = await get('/api/version');
      if (r.status !== 200) throw new Error(`status ${r.status}`);
      if (!r.json?.version) throw new Error('no version field');
      return `${r.json.version}${r.json.commit ? `@${r.json.commit}` : ''} (${r.json.env})`;
    },
  },
  {
    name: 'emergency status (maintenance/read-only)',
    run: async () => {
      const r = await get('/api/emergency/status');
      if (r.status !== 200) throw new Error(`status ${r.status}`);
      const m = r.json?.maintenance ? 'MAINTENANCE' : 'live';
      const ro = r.json?.readOnly ? ' read-only' : '';
      return `${m}${ro}`;
    },
  },
  {
    name: 'landing page (200)',
    run: async () => {
      const r = await get('/');
      if (r.status !== 200) throw new Error(`status ${r.status}`);
      return `${r.text.length} bytes`;
    },
  },
];

const results = [];
for (const c of checks) {
  try {
    const detail = await c.run();
    results.push({ ok: true, name: c.name, detail });
    console.log(`  PASS  ${c.name} — ${detail}`);
  } catch (err) {
    results.push({ ok: false, name: c.name, detail: String(err?.message ?? err) });
    console.log(`  FAIL  ${c.name} — ${err?.message ?? err}`);
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\nSmoke test against ${base}: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error(`SMOKE FAILED: ${failed.map((r) => r.name).join(', ')}`);
  process.exit(1);
}
console.log('SMOKE OK');
