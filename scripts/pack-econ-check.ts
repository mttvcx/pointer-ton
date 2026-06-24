/** Print pack economics (edge / RTP) at reference prices. Run: node --import tsx scripts/pack-econ-check.ts */
import { buildPackConfigFromTemplate, PACK_TEMPLATE_LIST } from '../lib/packs/packTemplates';
import { computePackEconomics } from '../lib/packs/packEconomics';

const refPrice: Record<string, number> = { bronze: 0.15, silver: 0.5, gold: 2, legendary: 5 };

for (const t of PACK_TEMPLATE_LIST) {
  const price = refPrice[t.type] ?? 1;
  const cfg = buildPackConfigFromTemplate(t, price);
  const e = computePackEconomics(cfg);
  const rtp = (e.fullOpenEvSol / price) * 100;
  console.log(
    `${t.type.padEnd(10)} cards=${t.cardsPerOpen} price=${price}  EV=${e.fullOpenEvSol.toFixed(4)} (RTP ${rtp.toFixed(1)}%)  edge=${(e.houseEdgeBps / 100).toFixed(1)}%  valid=${e.valid}${e.errors.length ? ' ' + e.errors.join('|') : ''}`,
  );
}
