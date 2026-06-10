export type PoolWalletRole = 'lp' | 'bonding_curve';

/** Display label for non-person holder accounts (Axiom parity). */
export function poolRoleDisplayLabel(
  role: PoolWalletRole | 'locked_vault' | null | undefined,
): string | null {
  if (role === 'lp') return 'LIQUIDITY POOL';
  if (role === 'bonding_curve') return 'BONDING CURVE';
  if (role === 'locked_vault') return 'LOCKED';
  return null;
}
