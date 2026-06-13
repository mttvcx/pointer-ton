import assert from 'node:assert/strict';
import test from 'node:test';
import { formatTerminalNativeString, parseTerminalNativeBalance } from '@/lib/utils/terminalNativeFormat';

test('parseTerminalNativeBalance subscript for tiny SOL amounts', () => {
  const p = parseTerminalNativeBalance(0.004218);
  assert.equal(p.kind, 'subscript');
  if (p.kind === 'subscript') {
    assert.equal(p.zeroCount, 2);
    assert.equal(p.tail, '42');
  }
  assert.equal(formatTerminalNativeString(0.004218), '0.0₂42');
  assert.equal(formatTerminalNativeString(0.0000923), '0.0₄92');
});

test('parseTerminalNativeBalance plain for >= 0.01', () => {
  assert.equal(formatTerminalNativeString(0.05), '0.05');
  assert.equal(formatTerminalNativeString(1.5), '1.5');
});

test('parseTerminalNativeBalance zero and negative', () => {
  assert.equal(formatTerminalNativeString(0), '0');
  assert.equal(formatTerminalNativeString(-0.004218), '-0.0₂42');
});
