import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getMobilePlatform, isMobileUserAgent } from '@/lib/utils/userAgent';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Safari/605.1.15';
const GOOGLEBOT_MOBILE = 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const FB = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

describe('isMobileUserAgent', () => {
  it('detects real phones', () => {
    assert.equal(isMobileUserAgent(IPHONE), true);
    assert.equal(isMobileUserAgent(ANDROID), true);
  });
  it('treats desktop as not-mobile', () => {
    assert.equal(isMobileUserAgent(DESKTOP), false);
    assert.equal(isMobileUserAgent(MAC), false);
  });
  it('lets bots / link-preview crawlers through (not mobile) for SEO + OG', () => {
    assert.equal(isMobileUserAgent(GOOGLEBOT_MOBILE), false);
    assert.equal(isMobileUserAgent(FB), false);
  });
  it('is safe on empty input', () => {
    assert.equal(isMobileUserAgent(null), false);
    assert.equal(isMobileUserAgent(undefined), false);
    assert.equal(isMobileUserAgent(''), false);
  });
  it('catches iPadOS (desktop-masquerading) only with a touch signal', () => {
    assert.equal(isMobileUserAgent(MAC, { touchPoints: 5 }), true);
    assert.equal(isMobileUserAgent(MAC, { touchPoints: 0 }), false);
  });
});

describe('getMobilePlatform', () => {
  it('picks the right store', () => {
    assert.equal(getMobilePlatform(ANDROID), 'android');
    assert.equal(getMobilePlatform(IPHONE), 'ios');
    assert.equal(getMobilePlatform(DESKTOP), 'ios'); // default
    assert.equal(getMobilePlatform(null), 'ios');
  });
});
