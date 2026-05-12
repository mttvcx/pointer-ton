import type { OperatorSignalLevel } from '@/lib/squads/types';

export function operatorSignalLabel(level: OperatorSignalLevel): string {
  switch (level) {
    case 'high':
      return 'Operator Signal · High';
    case 'medium':
      return 'Operator Signal · Medium';
    case 'low':
      return 'Operator Signal · Low';
    case 'unknown':
    default:
      return 'Operator Signal · Unknown';
  }
}
