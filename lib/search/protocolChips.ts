import type { AppChainId } from '@/lib/chains/appChain';
import type { ProtocolBrandId } from '@/lib/tokens/protocolBrand';

/**
 * Axiom-style protocol filter chips — the most popular launchpads / DEXes per
 * chain, front-loaded (we deliberately don't list every long-tail protocol).
 * `keywords` match against a token's `protocol_id` / `protocol_family`.
 */
export type ProtocolChip = {
  id: string;
  label: string;
  logo: ProtocolBrandId;
  keywords: string[];
};

const CHIPS = {
  pump: { id: 'pump', label: 'Pump', logo: 'pump.fun', keywords: ['pump'] },
  bonk: { id: 'bonk', label: 'Bonk', logo: 'bonk', keywords: ['bonk', 'launchlab'] },
  bags: { id: 'bags', label: 'Bags', logo: 'bags', keywords: ['bags'] },
  moonshot: { id: 'moonshot', label: 'Moonshot', logo: 'moonshot', keywords: ['moon'] },
  believe: { id: 'believe', label: 'Believe', logo: 'believe', keywords: ['believe'] },
  fourmeme: { id: 'fourmeme', label: 'Four.meme', logo: 'four.meme', keywords: ['four', '4meme'] },
  pancake: { id: 'pancake', label: 'Pancake', logo: 'pancakeswap', keywords: ['pancake'] },
  uniswap: { id: 'uniswap', label: 'Uniswap', logo: 'uniswap', keywords: ['uniswap', 'uni'] },
  zora: { id: 'zora', label: 'Zora', logo: 'zora-content', keywords: ['zora'] },
  clanker: { id: 'clanker', label: 'Clanker', logo: 'clanker', keywords: ['clanker'] },
  virtuals: { id: 'virtuals', label: 'Virtuals', logo: 'virtuals', keywords: ['virtual'] },
  robinhood: { id: 'robinhood', label: 'Robinhood', logo: 'robinhood', keywords: ['robinhood', 'hood'] },
  stonfi: { id: 'stonfi', label: 'STON.fi', logo: 'stonfi', keywords: ['ston'] },
  dedust: { id: 'dedust', label: 'DeDust', logo: 'dedust', keywords: ['dedust'] },
} satisfies Record<string, ProtocolChip>;

export function protocolChipsForChain(chain: AppChainId): ProtocolChip[] {
  switch (chain) {
    case 'sol':
      return [CHIPS.pump, CHIPS.bonk, CHIPS.bags, CHIPS.moonshot, CHIPS.believe];
    case 'bnb':
      return [CHIPS.fourmeme, CHIPS.pancake];
    case 'base':
      return [CHIPS.uniswap, CHIPS.zora, CHIPS.clanker, CHIPS.virtuals];
    case 'eth':
      return [CHIPS.uniswap];
    case 'robinhood':
      return [CHIPS.robinhood];
    case 'ton':
      return [CHIPS.stonfi, CHIPS.dedust];
    default:
      return [];
  }
}

export function tokenMatchesProtocolChip(
  chip: ProtocolChip,
  protocolId: string | null | undefined,
  protocolFamily: string | null | undefined,
): boolean {
  const id = (protocolId ?? '').toLowerCase();
  const fam = (protocolFamily ?? '').toLowerCase();
  return chip.keywords.some((k) => id.includes(k) || fam.includes(k));
}
