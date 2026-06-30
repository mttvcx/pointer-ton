/**
 * One-off: load the committed KOL/identity directory seeds (data/identity/*.json)
 * into identity_profiles / identity_wallets. These shipped in the repo but were
 * never persisted, so the directory (and the extension's universal labels) was
 * empty. Run: set -a; . ./.env.local; set +a; node --import tsx scripts/import-identity-seeds.ts
 */
import solKolscanSeed from '@/data/identity/solana-kolscan-seed.json';
import ethGmgnSeed from '@/data/identity/eth-gmgn-seed.json';
import baseGmgnSeed from '@/data/identity/base-gmgn-seed.json';
import bnbGmgnSeed from '@/data/identity/bnb-gmgn-seed.json';
import gmgnTrackWallet20Seed from '@/data/identity/gmgn-track-wallet-20-seed.json';
import gmgnTrackEvmWallet20Seed from '@/data/identity/gmgn-track-evm-wallet-20-seed.json';
import axiomKolSolSeed from '@/data/identity/axiom-kol-sol-seed.json';
import cabalspySolSeed from '@/data/identity/cabalspy-sol-seed.json';
import cabalspyEvmSeed from '@/data/identity/cabalspy-evm-seed.json';
import solscannerKolSolSeed from '@/data/identity/solscanner-kol-sol-seed.json';
import kolscanPartialOverrides from '@/data/identity/kolscan-partial-overrides.json';
import { persistIdentitySeedRows } from '@/lib/db/identityRegistry';
import type { IdentitySeedRow } from '@/lib/identity/types';

const all = [
  solKolscanSeed,
  axiomKolSolSeed,
  solscannerKolSolSeed,
  cabalspySolSeed,
  cabalspyEvmSeed,
  gmgnTrackWallet20Seed,
  gmgnTrackEvmWallet20Seed,
  ethGmgnSeed,
  baseGmgnSeed,
  bnbGmgnSeed,
  kolscanPartialOverrides,
].flat() as IdentitySeedRow[];

async function main() {
  console.log(`Persisting ${all.length} identity seed rows…`);
  const res = await persistIdentitySeedRows(all);
  console.log(`✓ imported ${res.imported}, skipped ${res.skipped}`);
}

void main().catch((e) => {
  console.error('import failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
