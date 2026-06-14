import 'server-only';

import type { AppChainId } from '@/lib/chains/appChain';
import type { IdentitySeedRow } from '@/lib/identity/types';
import { gmgnWalletCopyUrl } from '@/lib/identity/config';
import { parseGmgnExport as parseGmgnExportCore } from '@/lib/identity/providers/gmgnParse';

export type GmgnImportResult = {
  rows: IdentitySeedRow[];
  sourceUrl: string;
  note: string;
};

export async function fetchGmgnRankTab(chain: AppChainId): Promise<GmgnImportResult> {
  const url =
    chain === 'eth' || chain === 'bnb' || chain === 'base'
      ? gmgnWalletCopyUrl(chain)
      : gmgnWalletCopyUrl('eth');
  return {
    rows: [],
    sourceUrl: url,
    note:
      'No public GMGN API wired. Paste Track tab export JSON via /api/identity/import (format=gmgn) or commit data/identity/*-gmgn-seed.json.',
  };
}

export { parseGmgnExportCore as parseGmgnExport };
