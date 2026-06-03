import { LAUNCHPAD_AVATAR_PROTOCOLS } from '@/lib/tokens/launchpadAvatarChrome';
import { protocolBrand, type ProtocolBrandId } from '@/lib/tokens/protocolBrand';

/** Launchpads shown in Display → Row protocol color grid (Axiom-style). */
export const PULSE_DISPLAY_PROTOCOL_IDS = Array.from(LAUNCHPAD_AVATAR_PROTOCOLS).filter(
  (id): id is ProtocolBrandId => {
    if (id === 'ton' || id === 'bsc' || id === 'base') return false;
    return Boolean(protocolBrand(id));
  },
);

export function pulseDisplayProtocolLabel(id: ProtocolBrandId): string {
  return protocolBrand(id)?.label ?? id;
}

export function pulseDisplayProtocolColor(id: ProtocolBrandId): string {
  return protocolBrand(id)?.color ?? '#888';
}
