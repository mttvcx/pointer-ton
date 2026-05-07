import { createHash } from 'crypto';

export function normalizeBetaCodeInput(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function hashBetaCode(normalizedCode: string, pepper: string): string {
  return createHash('sha256').update(`${normalizedCode}:${pepper}`, 'utf8').digest('hex');
}
