/** Front-facing odds — never show tiny decimals like 0.05%. */
export function formatProbabilityBps(bps: number): string {
  if (bps <= 0) return '0%';
  const pct = bps / 100;
  if (pct < 1) return '< 1%';
  if (pct >= 10) return `${pct.toFixed(0)}%`;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  return '< 1%';
}

export function formatProbabilityPctFromBps(bps: number): string {
  return formatProbabilityBps(bps);
}
