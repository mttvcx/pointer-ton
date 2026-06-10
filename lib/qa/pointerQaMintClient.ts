/** Client-safe QA mint gate (mirrors server `POINTER_QA_MINT` / default WIF). */
export const DEFAULT_POINTER_QA_MINT =
  'CExejcGZSEnk4FBsBQa3nMnU1jjCYsjw4x9d7cJ4pump';

export function getPointerQaMintClient(): string {
  const raw = process.env.NEXT_PUBLIC_POINTER_QA_MINT?.trim();
  return raw && raw.length > 0 ? raw : DEFAULT_POINTER_QA_MINT;
}

export function isPointerQaMintClient(mint: string | null | undefined): boolean {
  if (!mint?.trim()) return false;
  return mint.trim() === getPointerQaMintClient();
}
