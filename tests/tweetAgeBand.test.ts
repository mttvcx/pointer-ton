import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  approxTweetCreatedAtMs,
  tweetAgeBand,
  tweetFeatherColorClass,
  TWEET_AGE_MS,
} from '@/lib/tokens/pulseSocialLinks';

describe('tweetAgeBand', () => {
  it('classifies by snowflake age thresholds', () => {
    const now = Date.now();
    const freshId = (BigInt(now - TWEET_AGE_MS.fresh / 2 - 1288834974657) << 22n).toString();
    const warmId = (BigInt(now - 2 * TWEET_AGE_MS.fresh - 1288834974657) << 22n).toString();
    const staleId = (BigInt(now - TWEET_AGE_MS.warm - 60_000 - 1288834974657) << 22n).toString();

    const freshUrl = `https://x.com/user/status/${freshId}`;
    const warmUrl = `https://x.com/user/status/${warmId}`;
    const staleUrl = `https://x.com/user/status/${staleId}`;

    assert.equal(tweetAgeBand(freshUrl), 'fresh');
    assert.equal(tweetAgeBand(warmUrl), 'warm');
    assert.equal(tweetAgeBand(staleUrl), 'stale');
    assert.match(tweetFeatherColorClass(freshUrl), /00C27A/);
    assert.match(tweetFeatherColorClass(warmUrl), /F7931A/);
    assert.match(tweetFeatherColorClass(staleUrl), /EF4444/);
  });

  it('approxTweetCreatedAtMs decodes status URLs', () => {
    const url = 'https://x.com/blknoiz06/status/1740000000000000000';
    const ms = approxTweetCreatedAtMs(url);
    assert.notEqual(ms, null);
    assert.ok(ms! > 1_600_000_000_000);
  });
});
