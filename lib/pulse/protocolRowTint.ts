import { pulseDisplayProtocolColor } from '@/components/pulse/pulseDisplayProtocols';
import type { PulseDisplayPrefs } from '@/lib/preferences/pulseDisplay';
import type { ProtocolBrandId } from '@/lib/tokens/protocolBrand';

export type ProtocolRowTint = {
  protocolId: ProtocolBrandId;
  color: string;
};

/** Resolve protocol row tint when Color row is on and the launchpad is enabled. */
export function resolveProtocolRowTint(
  prefs: Pick<PulseDisplayPrefs, 'colorRowByProtocol' | 'protocolRowColors' | 'protocolColorHex'>,
  protocolId: string | null | undefined,
): ProtocolRowTint | null {
  if (!prefs.colorRowByProtocol || !protocolId) return null;
  if (!prefs.protocolRowColors[protocolId]) return null;

  const color =
    prefs.protocolColorHex[protocolId] ?? pulseDisplayProtocolColor(protocolId as ProtocolBrandId);

  return { protocolId: protocolId as ProtocolBrandId, color };
}
