import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOUNDER_BETA_BUY_PRESETS_SOL,
  resolveBuyPresetsSol,
  resolveDefaultBuyPresetSol,
} from '@/lib/beta/founderBeta';
import { BUY_PRESETS_SOL } from '@/lib/utils/constants';

test('resolveBuyPresetsSol uses founder min trade when flag set', () => {
  const prev = process.env.NEXT_PUBLIC_FOUNDER_BETA;
  try {
    delete process.env.NEXT_PUBLIC_FOUNDER_BETA;
    assert.deepEqual([...resolveBuyPresetsSol()], [...BUY_PRESETS_SOL]);
    assert.equal(resolveDefaultBuyPresetSol(), BUY_PRESETS_SOL[0]);

    process.env.NEXT_PUBLIC_FOUNDER_BETA = '1';
    assert.deepEqual([...resolveBuyPresetsSol()], [...FOUNDER_BETA_BUY_PRESETS_SOL]);
    assert.equal(resolveDefaultBuyPresetSol(), 0.001);
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_FOUNDER_BETA;
    else process.env.NEXT_PUBLIC_FOUNDER_BETA = prev;
  }
});
