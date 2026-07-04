import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isUniqueViolation } from '@/lib/db/pgError';

describe('isUniqueViolation', () => {
  it('matches the Postgres unique-violation SQLSTATE on error.code', () => {
    assert.equal(isUniqueViolation({ code: '23505', message: 'duplicate key' }), true);
    assert.equal(isUniqueViolation({ code: 23505 }), true); // numeric code tolerated
  });

  it('matches the canonical message / details text as a fallback', () => {
    assert.equal(
      isUniqueViolation({ message: 'duplicate key value violates unique constraint "x_uniq"' }),
      true,
    );
    assert.equal(isUniqueViolation({ details: 'Key (trade_id)=(abc) violates unique constraint' }), true);
  });

  it('does NOT match other Postgres errors', () => {
    assert.equal(isUniqueViolation({ code: '23503', message: 'foreign key violation' }), false);
    assert.equal(isUniqueViolation({ code: '23502', message: 'null value in column' }), false);
    assert.equal(isUniqueViolation({ message: 'connection reset' }), false);
  });

  it('is safe on non-error inputs', () => {
    assert.equal(isUniqueViolation(null), false);
    assert.equal(isUniqueViolation(undefined), false);
    assert.equal(isUniqueViolation('23505'), false);
    assert.equal(isUniqueViolation(42), false);
    assert.equal(isUniqueViolation(new Error('boom')), false);
  });
});
