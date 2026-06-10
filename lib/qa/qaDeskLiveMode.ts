import { isPointerQaMint } from '@/lib/qa/pointerQaMint';

/** QA mint desk uses indexed chain data only — no synthetic table rows or jitter. */
export function isQaDeskLiveMode(mint: string | null | undefined): boolean {
  return isPointerQaMint(mint);
}
