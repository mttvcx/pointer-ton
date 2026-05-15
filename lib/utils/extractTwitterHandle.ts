export function extractTwitterHandle(value: string): string {
  if (!value) return '';
  // Strip leading @ if present
  let v = value.trim().replace(/^@/, '');
  // If it's a full URL, extract just the handle
  if (v.includes('://')) {
    try {
      const u = new URL(v);
      // pathname = /handle or /handle/status/123
      v = u.pathname.split('/').filter(Boolean)[0] ?? '';
    } catch {
      v = v.split('/').filter(Boolean).pop() ?? '';
    }
  }
  return v;
}
