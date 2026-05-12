/** X (Twitter) search URL for exploring a wallet or contract address inline. */
export function xLiveSearchContractUrl(contractAddress: string): string {
  const q = contractAddress.trim();
  return `https://x.com/search?q=${encodeURIComponent(q)}&src=typed_query&f=live`;
}

/** Canonical profile URL; opens in browser / new tab outside Pointer. */
export function xProfileUrl(handle: string): string {
  const h = handle.trim().replace(/^@/, '').toLowerCase();
  return `https://x.com/${encodeURIComponent(h)}`;
}
