/** Normalize React Query cache values for `/api/trade/balance` (string or `{ rawAmount }`). */
export function balanceRawFromQueryData(data: unknown): string {
  if (data == null) return '0';
  if (typeof data === 'string') {
    const s = data.trim();
    return s.length > 0 ? s : '0';
  }
  if (typeof data === 'bigint') return data.toString();
  if (typeof data === 'number' && Number.isFinite(data)) return String(Math.trunc(data));
  if (typeof data === 'object' && 'rawAmount' in data) {
    const v = (data as { rawAmount: unknown }).rawAmount;
    if (v == null) return '0';
    if (typeof v === 'string') return v.trim() || '0';
    if (typeof v === 'bigint') return v.toString();
    if (typeof v === 'number' && Number.isFinite(v)) return String(Math.trunc(v));
  }
  return '0';
}
