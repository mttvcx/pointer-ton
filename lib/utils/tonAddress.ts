import { Address } from '@ton/core';

/** Canonical user-visible form for DB + auth subject (bounceable main). */
export function normalizeTonAddress(input: string): string | null {
  try {
    return Address.parse(input).toString({ bounceable: true, urlSafe: true });
  } catch {
    return null;
  }
}

export function assertTonAddress(input: string): string {
  const n = normalizeTonAddress(input);
  if (!n) throw new Error('invalid_ton_address');
  return n;
}

export function tonAuthSubject(address: string): string {
  const n = normalizeTonAddress(address);
  if (!n) throw new Error('invalid_ton_address');
  return `ton:${n}`;
}
