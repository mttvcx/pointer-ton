/** Edge/proxy-safe: rejects after `ms` so hung upstream calls can't freeze every page load. */
export function rejectAfter(ms: number, label: string): Promise<never> {
  return new Promise((_res, rej) => {
    setTimeout(() => {
      rej(new Error(label));
    }, ms);
  });
}
