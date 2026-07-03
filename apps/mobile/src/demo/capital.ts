/**
 * DEMO capital model for Pointer Financial (the Capital Dashboard). The product's
 * spine: every dollar is in one of four states — Trading / Earning / Spendable /
 * Reserved — never idle. Deterministic demo numbers until the real providers
 * (Bridge card + rails, Blend yield, Crossmint buys) are wired behind the backend.
 */

export type CapitalStates = {
  trading: number;
  earning: number;
  spendable: number;
  reserved: number;
};

export type FinActivityKind = 'swipe' | 'yield' | 'deposit' | 'reserve' | 'trade' | 'receive';
export type FinActivity = { id: string; kind: FinActivityKind; title: string; sub: string; amountUsd: number; when: string };

export type CapitalModel = {
  states: CapitalStates;
  total: number;
  apy: number;
  earnedToday: number;
  earnedTotal: number;
  yieldHistory: number[]; // normalized 0..1, oldest → newest
  cardLast4: string;
  points: number;
  pointsThisWeek: number;
  taxReserve: number;
  taxLiability: number;
  activity: FinActivity[];
  insights: string[];
};

export function getDemoCapital(): CapitalModel {
  const states: CapitalStates = { trading: 8420, earning: 24180, spendable: 3115, reserved: 940 };
  const total = states.trading + states.earning + states.spendable + states.reserved;
  return {
    states,
    total,
    apy: 6.2,
    earnedToday: 18.21,
    earnedTotal: 412.66,
    yieldHistory: [0.22, 0.3, 0.28, 0.41, 0.38, 0.52, 0.49, 0.63, 0.6, 0.71, 0.68, 0.82, 0.79, 0.9, 0.96],
    cardLast4: '9318',
    points: 12480,
    pointsThisWeek: 640,
    taxReserve: 940,
    taxLiability: 940,
    activity: [
      { id: 'a1', kind: 'yield', title: 'Smart Yield', sub: 'Overnight earnings', amountUsd: 18.21, when: '2m' },
      { id: 'a2', kind: 'swipe', title: 'Blue Bottle Coffee', sub: 'Pointer Card', amountUsd: -6.4, when: '3h' },
      { id: 'a3', kind: 'reserve', title: 'Tax reserve', sub: 'From realized gains', amountUsd: 214, when: '5h' },
      { id: 'a4', kind: 'trade', title: 'Bought $PENGU', sub: 'Moved to trading', amountUsd: -500, when: '6h' },
      { id: 'a5', kind: 'receive', title: 'Received transfer', sub: 'Virtual account · ACH', amountUsd: 1200, when: '1d' },
      { id: 'a6', kind: 'swipe', title: 'Apple', sub: 'Pointer Card', amountUsd: -129, when: '1d' },
      { id: 'a7', kind: 'deposit', title: 'Added with Apple Pay', sub: 'USD → USDC', amountUsd: 250, when: '2d' },
    ],
    insights: [
      'You earned $18.21 while you slept.',
      'You realized $4,200 in gains — I reserved $940. You’re covered for taxes.',
      '$3,115 is spendable and instantly ready — the rest is busy earning at 6.2%.',
    ],
  };
}
