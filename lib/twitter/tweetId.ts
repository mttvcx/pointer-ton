/** Token required by Twitter's public embed syndication endpoint (react-tweet / publish.twitter.com). */
export function syndicationTweetToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI)
    .toString(36)
    .replace(/(0+|\.)/g, '');
}

export function extractTweetId(url: string): string | null {
  const match = url.match(/\/status\/(\d+)/);
  return match?.[1] ?? null;
}
