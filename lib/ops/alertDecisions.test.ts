import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  alertColor,
  alertKey,
  alertTitle,
  buildAlertPayload,
  cooldownSeconds,
  shouldDispatch,
  summarizeDetail,
  type AlertEvent,
} from '@/lib/ops/alertDecisions';

describe('ops alerts: shouldDispatch', () => {
  it('fires on error status or error/critical severity', () => {
    assert.equal(shouldDispatch('error', 'error'), true);
    assert.equal(shouldDispatch('ok', 'critical'), true);
    assert.equal(shouldDispatch('warn', 'error'), true);
  });
  it('stays quiet for ok/warn/info', () => {
    assert.equal(shouldDispatch('ok', 'info'), false);
    assert.equal(shouldDispatch('warn', 'warn'), false);
    assert.equal(shouldDispatch('skipped', 'info'), false);
  });
});

describe('ops alerts: cooldown', () => {
  it('critical pages soonest, errors back off further', () => {
    assert.equal(cooldownSeconds('critical'), 300);
    assert.equal(cooldownSeconds('error'), 900);
    assert.equal(cooldownSeconds('warn'), 1800);
    assert.equal(cooldownSeconds('info'), 1800);
  });
  it('the cooldown key is per incident + severity', () => {
    assert.equal(alertKey('provider', 'helius', 'critical'), 'ops:alert:provider:helius:critical');
    assert.notEqual(alertKey('provider', 'helius', 'error'), alertKey('provider', 'helius', 'critical'));
  });
});

describe('ops alerts: formatting', () => {
  it('color maps by severity', () => {
    assert.equal(alertColor('critical'), 0xef4444);
    assert.equal(alertColor('error'), 0xf59e0b);
    assert.equal(alertColor('info'), 0x60a5fa);
  });
  it('title is a compact one-liner with the incident key', () => {
    const ev: AlertEvent = { category: 'webhook', name: 'helius:dead_letter', status: 'error', severity: 'critical' };
    assert.match(alertTitle(ev), /CRITICAL · webhook:helius:dead_letter/);
  });
  it('summarizeDetail truncates and tolerates circular refs', () => {
    assert.equal(summarizeDetail(undefined), '');
    assert.equal(summarizeDetail({}), '');
    const big = summarizeDetail({ a: 'x'.repeat(1000) }, 50);
    assert.ok(big.length <= 51 && big.endsWith('…'));
    const circ: Record<string, unknown> = {};
    circ.self = circ;
    assert.equal(summarizeDetail(circ), '');
  });
  it('buildAlertPayload includes message, color and an ops link', () => {
    const ev: AlertEvent = {
      category: 'provider',
      name: 'helius',
      status: 'error',
      severity: 'error',
      message: 'rate limited',
      detail: { credits: 0 },
    };
    const p = buildAlertPayload(ev, 'https://app.example.com/');
    assert.equal(p.message, 'rate limited');
    assert.equal(p.color, 0xf59e0b);
    assert.equal(p.opsUrl, 'https://app.example.com/admin/ops'); // trailing slash trimmed
    assert.ok(p.detail.includes('credits'));
  });
  it('buildAlertPayload handles missing message + appUrl', () => {
    const p = buildAlertPayload({ category: 'system', name: 'x', status: 'error', severity: 'error' });
    assert.equal(p.message, '(no message)');
    assert.equal(p.opsUrl, null);
  });
});
