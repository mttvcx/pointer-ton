import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickVerifiedEmail } from './verifiedEmail.ts';

test('email-OTP linked account → address (lowercased, trimmed)', () => {
  assert.equal(
    pickVerifiedEmail([{ type: 'email', address: '  Tom@Pointer.Trade  ' }]),
    'tom@pointer.trade',
  );
});

test('Google OAuth → email field', () => {
  assert.equal(
    pickVerifiedEmail([{ type: 'google_oauth', email: 'Founder@Gmail.com', name: 'F' }]),
    'founder@gmail.com',
  );
});

test('Apple OAuth → email field', () => {
  assert.equal(
    pickVerifiedEmail([{ type: 'apple_oauth', email: 'a@icloud.com' }]),
    'a@icloud.com',
  );
});

test('prefers explicit email account over Google/Apple', () => {
  const accounts = [
    { type: 'google_oauth', email: 'google@x.com' },
    { type: 'email', address: 'primary@x.com' },
    { type: 'apple_oauth', email: 'apple@x.com' },
  ];
  assert.equal(pickVerifiedEmail(accounts), 'primary@x.com');
});

test('prefers Google over Apple when no explicit email account', () => {
  const accounts = [
    { type: 'apple_oauth', email: 'apple@x.com' },
    { type: 'google_oauth', email: 'google@x.com' },
  ];
  assert.equal(pickVerifiedEmail(accounts), 'google@x.com');
});

test('ignores non-email accounts (wallet, twitter)', () => {
  const accounts = [
    { type: 'wallet', address: 'So11111111111111111111111111111111111111112', chain_type: 'solana' },
    { type: 'twitter_oauth', username: 'someone' },
  ];
  assert.equal(pickVerifiedEmail(accounts), null);
});

test('a wallet address is never mistaken for an email (no @)', () => {
  // The wallet `address` field must not leak through the email path.
  assert.equal(
    pickVerifiedEmail([{ type: 'wallet', address: 'NotAnEmailJustAPubkey' }]),
    null,
  );
});

test('rejects malformed email values', () => {
  assert.equal(pickVerifiedEmail([{ type: 'email', address: 'no-at-sign' }]), null);
  assert.equal(pickVerifiedEmail([{ type: 'email', address: '@nodomain' }]), null);
  assert.equal(pickVerifiedEmail([{ type: 'email', address: 'nolocal@' }]), null);
  assert.equal(pickVerifiedEmail([{ type: 'google_oauth', email: 123 }]), null);
});

test('null / non-array / empty → null', () => {
  assert.equal(pickVerifiedEmail(null), null);
  assert.equal(pickVerifiedEmail(undefined), null);
  assert.equal(pickVerifiedEmail('not-an-array'), null);
  assert.equal(pickVerifiedEmail([]), null);
  assert.equal(pickVerifiedEmail([null, 42, 'x']), null);
});
