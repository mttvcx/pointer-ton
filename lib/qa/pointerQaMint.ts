import 'server-only';

/** Canonical QA token — dogwifhat (WIF) on pump.fun; active desk for founder-beta wiring. */
export const DEFAULT_POINTER_QA_MINT =
  'CExejcGZSEnk4FBsBQa3nMnU1jjCYsjw4x9d7cJ4pump';

export function getPointerQaMint(): string {
  const raw = process.env.POINTER_QA_MINT?.trim();
  return raw && raw.length > 0 ? raw : DEFAULT_POINTER_QA_MINT;
}

/** When true, expensive holder/pump enrich only runs for {@link getPointerQaMint}. */
export function pointerQaMintOnly(): boolean {
  return process.env.POINTER_QA_MINT_ONLY === '1';
}

export function isPointerQaMint(mint: string | null | undefined): boolean {
  if (!mint?.trim()) return false;
  return mint.trim() === getPointerQaMint();
}

/** Client-safe check (public env mirrors server mint for UI gating). */
export function isPointerQaMintClient(mint: string | null | undefined): boolean {
  const qa =
    process.env.NEXT_PUBLIC_POINTER_QA_MINT?.trim() ||
    DEFAULT_POINTER_QA_MINT;
  return Boolean(mint?.trim() && mint.trim() === qa);
}
