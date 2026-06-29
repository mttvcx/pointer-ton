/**
 * Environment validation CLI.
 *
 *   node --import tsx scripts/validate-env.ts            # preflight: require all REQUIRED present (deploy gate)
 *   node --import tsx scripts/validate-env.ts --schema   # CI: validate the contract shape only (no secrets needed)
 *
 * Exits non-zero on failure so it can gate a deploy. Recommended-but-missing keys
 * are warned, never fatal.
 */
import { validateEnv, validateSchemaShape, ENV_GROUPS } from '@/lib/env/required';

const schemaOnly = process.argv.includes('--schema');

if (schemaOnly) {
  const { ok, errors } = validateSchemaShape();
  if (!ok) {
    console.error('✗ env schema is malformed:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  const required = ENV_GROUPS.filter((g) => g.tier === 'required').length;
  const recommended = ENV_GROUPS.filter((g) => g.tier === 'recommended').length;
  console.log(`✓ env schema OK (${ENV_GROUPS.length} groups: ${required} required, ${recommended} recommended)`);
  process.exit(0);
}

const { ok, missingRequired, missingRecommended } = validateEnv(process.env);

for (const id of missingRecommended) {
  const g = ENV_GROUPS.find((x) => x.id === id);
  console.warn(`⚠ recommended env missing: ${id} (${g?.anyOf.join(' | ')}) — ${g?.note}`);
}

if (!ok) {
  console.error('\n✗ REQUIRED environment groups missing — the app cannot run:');
  for (const id of missingRequired) {
    const g = ENV_GROUPS.find((x) => x.id === id);
    console.error(`  - ${id}: set one of [${g?.anyOf.join(', ')}] — ${g?.note}`);
  }
  process.exit(1);
}

console.log('✓ all required environment groups present');
process.exit(0);
