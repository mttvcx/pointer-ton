import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ENV_GROUPS, validateEnv, validateSchemaShape } from '@/lib/env/required';

/** A minimal env bag that satisfies every required group (one key each). */
function fullRequiredEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const g of ENV_GROUPS) {
    if (g.tier === 'required') env[g.anyOf[0]!] = 'x';
  }
  return env;
}

describe('env: validateEnv', () => {
  it('passes when every required group is satisfied', () => {
    const v = validateEnv(fullRequiredEnv());
    assert.equal(v.ok, true);
    assert.deepEqual(v.missingRequired, []);
  });

  it('fails and names the group when a required key is missing', () => {
    const env = fullRequiredEnv();
    delete env['UPSTASH_REDIS_REST_URL'];
    const v = validateEnv(env);
    assert.equal(v.ok, false);
    assert.ok(v.missingRequired.includes('redis'));
  });

  it('accepts an alternate key in an anyOf group', () => {
    const env = fullRequiredEnv();
    // swap the primary supabase service key for its alternate
    delete env['SUPABASE_SERVICE_ROLE_KEY'];
    env['SUPABASE_SECRET_KEY'] = 'x';
    const v = validateEnv(env);
    assert.equal(v.ok, true);
  });

  it('treats empty / whitespace values as missing', () => {
    const env = fullRequiredEnv();
    env['CRON_SECRET'] = '   ';
    const v = validateEnv(env);
    assert.equal(v.ok, false);
    assert.ok(v.missingRequired.includes('cron_secret'));
  });

  it('missing recommended keys never fail the gate', () => {
    const v = validateEnv(fullRequiredEnv());
    assert.equal(v.ok, true);
    assert.ok(v.missingRecommended.length > 0); // none of the recommended set is present
  });
});

describe('env: validateSchemaShape', () => {
  it('the shipped contract is well-formed (unique ids, non-empty anyOf, valid tiers)', () => {
    const { ok, errors } = validateSchemaShape();
    assert.deepEqual(errors, []);
    assert.equal(ok, true);
  });
});
