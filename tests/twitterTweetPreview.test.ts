import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatAxiomEngagement,
  formatAxiomTweetTimestamp,
} from '@/lib/twitter/tweetHoverFormat';
import { parseFxTwitterMedia } from '@/lib/twitter/fxTwitterMedia';
import { syndicationTweetToken, extractTweetId } from '@/lib/twitter/tweetId';
import {
  normalizeTwitterTweetPreview,
  tweetPreviewMediaUrls,
} from '@/lib/twitter/tweetPreviewTypes';

describe('twitter tweet preview', () => {
  it('extractTweetId parses status URLs', () => {
    assert.equal(
      extractTweetId('https://x.com/i/status/2064142601972826253'),
      '2064142601972826253',
    );
  });

  it('syndicationTweetToken matches react-tweet formula', () => {
    const id = '2064142601972826253';
    const token = syndicationTweetToken(id);
    assert.match(token, /^[a-z0-9]+$/i);
    assert.ok(token.length > 0);
  });

  it('formatAxiomEngagement uses em dash for missing counts', () => {
    assert.equal(formatAxiomEngagement(null), '—');
    assert.equal(formatAxiomEngagement(5310), '5.31K');
  });

  it('formatAxiomTweetTimestamp matches Axiom clock row', () => {
    const s = formatAxiomTweetTimestamp('2026-06-09T00:28:40.000Z');
    assert.match(s, /^Jun \d+, 2026,/);
    assert.match(s, /PM|AM$/);
  });

  it('normalizeTwitterTweetPreview fills missing mediaUrls from legacy cache', () => {
    const normalized = normalizeTwitterTweetPreview({
      type: 'tweet',
      url: 'https://x.com/i/status/2064142601972826253',
      fallback: false,
      text: 'hello',
      media: 'https://pbs.twimg.com/media/a.jpg',
    });
    assert.deepEqual(tweetPreviewMediaUrls(normalized), ['https://pbs.twimg.com/media/a.jpg']);
    assert.deepEqual(normalized.mediaUrls, ['https://pbs.twimg.com/media/a.jpg']);
  });

  it('parseFxTwitterMedia collects photos and mosaic', () => {
    const urls = parseFxTwitterMedia({
      photos: [{ type: 'photo', url: 'https://pbs.twimg.com/a.jpg' }],
      mosaic: { formats: { jpeg: 'https://pbs.twimg.com/mosaic.jpg' } },
    });
    assert.deepEqual(urls, [
      'https://pbs.twimg.com/mosaic.jpg',
      'https://pbs.twimg.com/a.jpg',
    ]);
  });
});
