/**
 * Prompt sanitization — pure, no I/O (unit-testable; safe to import anywhere).
 *
 * Every AI pipeline interpolates fields that originate OUTSIDE our trust
 * boundary — token names/symbols/descriptions (set by whoever launched the
 * token), wallet/KOL labels (external feeds), alert payloads, and free-text the
 * user types. Untreated, those fields can carry prompt-injection ("ignore the
 * above and ...") or structural tricks (fake delimiters / new instruction lines)
 * that change the model's behavior. Because several pipelines CACHE the model's
 * answer by a trusted key (mint / address) and serve it to every user, a single
 * injected token description could poison the cached analysis for everyone.
 *
 * Defense, applied before interpolation:
 *  - Unicode-fold (NFKC) so look-alike/full-width characters can't smuggle
 *    structure past the filters below.
 *  - Drop everything outside printable ASCII — this removes ALL newlines, tabs
 *    and control chars, so untrusted text can never open a new "instruction
 *    line" or role marker, and strips zero-width / bidi injection characters.
 *  - Strip quotes, backticks and angle/curly brackets so it can't close one of
 *    our delimiters or open a fake code/JSON block.
 *  - Collapse whitespace and hard-truncate so a field can't blow the budget.
 */
export function sanitizeForPrompt(s: string | null | undefined, max = 200): string {
  if (!s) return '';
  return s
    .normalize('NFKC')
    .replace(/[^\x20-\x7E]+/g, ' ') // printable ASCII only → kills newlines/control/zero-width/bidi
    .replace(/["'`{}<>]/g, '') // no quotes/backticks/brackets to break out of delimiters
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * Wrap an untrusted value in an explicit, un-spoofable data fence so the prompt
 * makes the trust boundary obvious to the model. The content is sanitized first
 * (so it cannot contain the fence token or any delimiter), then placed between
 * `<<label>> ... <<end>>` markers. Returns an empty string for empty content so
 * callers can drop the line entirely.
 */
export function delimitUntrusted(label: string, value: string | null | undefined, max = 200): string {
  const clean = sanitizeForPrompt(value, max);
  if (!clean) return '';
  const tag =
    sanitizeForPrompt(label, 32)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'data';
  return `<<${tag}>> ${clean} <<end_${tag}>>`;
}

/**
 * Sanitize an arbitrary JSON-ish payload for inclusion in a prompt: serialize,
 * then run the string through {@link sanitizeForPrompt}. Use for alert payloads
 * and other structured blobs whose VALUES are untrusted.
 */
export function sanitizeJsonForPrompt(payload: unknown, max = 1000): string {
  let str: string;
  try {
    str = JSON.stringify(payload) ?? '';
  } catch {
    str = '';
  }
  return sanitizeForPrompt(str, max);
}
