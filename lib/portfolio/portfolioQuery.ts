/** React Query scope when no `wallet` query param is sent (primary / default wallet). */
export const PORTFOLIO_QUERY_SCOPE_DEFAULT = '__default__' as const;

export type PortfolioQueryScope = typeof PORTFOLIO_QUERY_SCOPE_DEFAULT | string;

export function portfolioQueryScope(walletAddress?: string | null): PortfolioQueryScope {
  const w = walletAddress?.trim();
  return w ? w : PORTFOLIO_QUERY_SCOPE_DEFAULT;
}

export function portfolioQueryKey(walletAddress?: string | null) {
  return ['portfolio', portfolioQueryScope(walletAddress)] as const;
}

export type PortfolioFetchOptions = {
  tradesLimit?: number;
  fifoLimit?: number;
};

export function portfolioFetchUrl(
  walletAddress?: string | null,
  opts: PortfolioFetchOptions = {},
): string {
  const tradesLimit = opts.tradesLimit ?? 80;
  const fifoLimit = opts.fifoLimit ?? 400;
  const base = `/api/portfolio?tradesLimit=${tradesLimit}&fifoLimit=${fifoLimit}`;
  const w = walletAddress?.trim();
  return w ? `${base}&wallet=${encodeURIComponent(w)}` : base;
}

export async function fetchPortfolioJson<T = unknown>(
  getAccessToken: () => Promise<string | null>,
  walletAddress?: string | null,
  opts: PortfolioFetchOptions = {},
): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new Error('no_token');
  const res = await fetch(portfolioFetchUrl(walletAddress, opts), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json: unknown = await res.json();
  if (!res.ok) {
    const msg =
      typeof json === 'object' && json
        ? 'message' in json
          ? String((json as { message: unknown }).message)
          : 'error' in json
            ? String((json as { error: unknown }).error)
            : 'portfolio failed'
        : 'portfolio failed';
    throw new Error(msg);
  }
  return json as T;
}
