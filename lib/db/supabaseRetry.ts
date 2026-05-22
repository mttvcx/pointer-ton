import 'server-only';

const RETRYABLE = /fetch failed|ECONNRESET|ENOTFOUND|getaddrinfo|ETIMEDOUT|socket hang up/i;

function retryDelayMs(attempt: number): number {
  return [250, 750, 1500][attempt] ?? 1500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry transient PostgREST/network failures (common on Windows dev after long sessions). */
export async function withSupabaseRetry<T>(
  label: string,
  fn: () => Promise<T>,
  opts?: { attempts?: number },
): Promise<T> {
  const attempts = opts?.attempts ?? 3;
  let lastErr: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const message = err instanceof Error ? err.message : String(err);
      if (!RETRYABLE.test(message) || i === attempts - 1) {
        throw err instanceof Error ? err : new Error(`${label}: ${message}`);
      }
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[supabase-retry] ${label} attempt ${i + 1}/${attempts}: ${message}`);
      }
      await sleep(retryDelayMs(i));
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(`${label} failed`);
}
