import 'server-only';

/**
 * Known Solana CEX / bridge hot wallets → venue label for desk funding column.
 * Expand as we validate deposit rails (Axiom parity).
 */
export const CEX_FUNDING_WALLETS: Readonly<Record<string, string>> = {
  '2AQdpHJ2JpcEgPiATUXjQxA8QmafFegfQwSLWSprPicm': 'Coinbase',
  '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1dJrpbwVzPiHu1': 'Binance',
  'H8sMJSCQxfYfemRfysTR2jQF6KSHXTDzxYZgrX77dbME': 'Bybit',
  'ASTyfSima4LLAdDgoFGkgqoKowG1LZFDr9fAQrg7iaJZ': 'MEXC',
  'FWznbcNXWQuHTawe9RxvQ2L9RmeJqYc6uLyjQuHXgga': 'Kraken',
  'AC5RDfQFmDS1deWZos921JfqscXdktLuwM6CCY5tPgF': 'OKX',
  'GJRs4FwHtemZ5ZE9x3TKx7ixmBpfm8q4BJpW4PpJoV3': 'Gate.io',
};

export function cexVenueForFundingSource(fromAddress: string | null | undefined): string | null {
  if (!fromAddress?.trim()) return null;
  return CEX_FUNDING_WALLETS[fromAddress.trim()] ?? null;
}
