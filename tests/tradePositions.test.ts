import assert from 'node:assert/strict';
import test from 'node:test';
import { filterTradeTokenPositions, isPortfolioFundingAsset } from '@/lib/portfolio/tradePositions';
import { SOL_MINT, USDC_MINT } from '@/lib/utils/addresses';

test('isPortfolioFundingAsset excludes native and stables', () => {
  assert.equal(isPortfolioFundingAsset(SOL_MINT, 'SOL'), true);
  assert.equal(isPortfolioFundingAsset(USDC_MINT, 'USDC'), true);
  assert.equal(isPortfolioFundingAsset('SomeMint', 'USDT'), true);
  assert.equal(isPortfolioFundingAsset('SomeMint', 'PYUSD'), true);
  assert.equal(isPortfolioFundingAsset('BONKm1nt', 'BONK'), false);
});

test('filterTradeTokenPositions keeps only trade tokens', () => {
  const rows = [
    { mint: SOL_MINT, symbol: 'SOL' },
    { mint: USDC_MINT, symbol: 'USDC' },
    { mint: 'BONKm1nt', symbol: 'BONK' },
  ];
  const out = filterTradeTokenPositions(rows);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.symbol, 'BONK');
});
