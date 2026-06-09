import 'server-only';

/** Canonical QA token — G7 Anchor on pump.fun (safe to hammer APIs / Supabase during desk wiring). */
export const DEFAULT_POINTER_QA_MINT =
  'GZQFCZjfzQyFSkA4jBuEeh5eKTLNzju7PZrEWxMvpump';

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
