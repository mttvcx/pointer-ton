/** Client-safe QA mint gate (mirrors server `POINTER_QA_MINT` / default G7anch). */
export const DEFAULT_POINTER_QA_MINT =
  'GZQFCZjfzQyFSkA4jBuEeh5eKTLNzju7PZrEWxMvpump';

export function getPointerQaMintClient(): string {
  const raw = process.env.NEXT_PUBLIC_POINTER_QA_MINT?.trim();
  return raw && raw.length > 0 ? raw : DEFAULT_POINTER_QA_MINT;
}

export function isPointerQaMintClient(mint: string | null | undefined): boolean {
  if (!mint?.trim()) return false;
  return mint.trim() === getPointerQaMintClient();
}
