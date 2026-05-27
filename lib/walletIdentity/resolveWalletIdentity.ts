import type { AppChainId } from '@/lib/chains/appChain';
import {
  type WalletIntelBadgeKind,
  type WalletIdentityView,
  type RecognizedWalletRecord,
} from '@/lib/walletIdentity/types';
import { getRecognizedWallet } from '@/lib/walletIdentity/mockRecognizedWallets';
import { shortenAddress } from '@/lib/utils/addresses';
import type { ResolvedWalletDisplay } from '@/lib/hooks/useWalletLabels';

function sourcePublicLabel(src: RecognizedWalletRecord['source']): string {
  switch (src) {
    case 'kol_feed':
      return 'Pointer signals';
    case 'pointer_directory':
      return 'Pointer directory';
    case 'admin_curated':
      return 'Operations';
    case 'import':
      return 'Imported list';
    case 'manual':
      return 'Manual note';
    case 'tracker':
      return 'Tracked';
    case 'user_label':
      return 'Your label';
    default:
      return 'Directory';
  }
}

function uniqBadges(xs: WalletIntelBadgeKind[]): WalletIntelBadgeKind[] {
  const out: WalletIntelBadgeKind[] = [];
  for (const b of xs) {
    if (!out.includes(b)) out.push(b);
  }
  return out;
}

export function resolveWalletIdentityCore(params: {
  address: string;
  chain: AppChainId;
  labelDisplay: ResolvedWalletDisplay | null;
  isTracked: boolean;
  extras?: WalletIntelBadgeKind[];
  creatorWallet?: string | null;
  /** When true, demo KOL/directory fixtures may enrich identity. */
  allowDemoDirectory?: boolean;
}): WalletIdentityView {
  const { address, chain, labelDisplay, isTracked, extras = [], creatorWallet, allowDemoDirectory = false } =
    params;
  const recognized = getRecognizedWallet(address, { demo: allowDemoDirectory });
  const renamed = Boolean(labelDisplay?.labeled);
  const userLabelText = labelDisplay?.labeled ? labelDisplay.label.trim() || null : null;

  const badges: WalletIntelBadgeKind[] = [...extras];
  if (isTracked) badges.push('tracked');
  if (renamed) badges.push('renamed');
  if (recognized) {
    for (const b of recognized.badges) {
      badges.push(b);
    }
  }
  if (creatorWallet && creatorWallet === address) badges.push('dev');

  const displayName =
    (labelDisplay?.labeled ? labelDisplay.label : null)?.trim() ||
    recognized?.displayName ||
    shortenAddress(address, 5);

  const handle =
    recognized?.handle?.replace(/^@/, '')?.length && recognized.handle
      ? `@${recognized.handle.replace(/^@/, '')}`
      : null;

  const identityHeadline = recognized?.displayName ?? displayName;

  let identitySourceLabel = 'Wallet address';
  let confidenceLabel: string | null = null;
  if (recognized) {
    identitySourceLabel = sourcePublicLabel(recognized.source);
    confidenceLabel = `${Math.round(recognized.confidence * 100)}%`;
  } else if (renamed) {
    identitySourceLabel = 'Your label';
  }

  const systemLabels: string[] = [];
  if (recognized?.category === 'kol') systemLabels.push('Public figure');
  if (recognized?.category === 'deployer') systemLabels.push('Deployer cohort');
  if (recognized?.category === 'smart_money') systemLabels.push('Smart desk');
  if (recognized?.category === 'streamer') systemLabels.push('Creator desk');

  /** Mock groups UX — persisted groups hook up later */
  const groups: string[] = [];
  if (isTracked) groups.push('Tracked wallets');

  const avatarUrl = recognized?.avatarUrl ?? null;

  return {
    address,
    chain,
    shortAddress: shortenAddress(address, 5),
    displayName,
    handle,
    avatarUrl,
    knownIdentity: recognized,
    identityHeadline,
    identitySourceLabel,
    confidenceLabel,
    badges: uniqBadges(badges),
    userLabelText,
    userLabelColor: labelDisplay?.labeled ? labelDisplay.color : null,
    systemLabels,
    groups,
    tracked: isTracked,
    renamed,
  };
}
