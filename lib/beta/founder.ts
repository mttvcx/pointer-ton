export function isFounderWallet(walletAddress: string | null | undefined, envList: string | undefined): boolean {
  if (!walletAddress?.trim() || !envList?.trim()) return false;
  const allowed = new Set(
    envList
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return allowed.has(walletAddress);
}
