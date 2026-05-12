/** Loose mainnet Bitcoin address shape check (P2PKH / P2SH / Bech32 / Taproot). */
export function looksLikeBitcoinAddress(raw: string): boolean {
  const t = raw.trim();
  if (/^bc1p[a-z0-9]{58,87}$/i.test(t)) return true;
  if (/^bc1[a-z0-9]{25,87}$/i.test(t)) return true;
  if (/^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(t)) return true;
  return false;
}
