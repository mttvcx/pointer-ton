export type BottomBarRegionId =
  | 'us-w'
  | 'us-c'
  | 'us-e'
  | 'sa-e'
  | 'eu-w'
  | 'eu-c'
  | 'eu-e'
  | 'as-se'
  | 'as-ne'
  | 'au-se';

export type BottomBarRegion = {
  id: BottomBarRegionId;
  label: string;
  /** Demo latency ms — replaced when edge routing is live. */
  latencyMs: number;
};

export const BOTTOM_BAR_REGIONS: BottomBarRegion[] = [
  { id: 'us-w', label: 'US-W', latencyMs: 24 },
  { id: 'us-c', label: 'US-C', latencyMs: 45 },
  { id: 'us-e', label: 'US-E', latencyMs: 3 },
  { id: 'sa-e', label: 'SA-E', latencyMs: 77 },
  { id: 'eu-w', label: 'EU-W', latencyMs: 94 },
  { id: 'eu-c', label: 'EU-C', latencyMs: 104 },
  { id: 'eu-e', label: 'EU-E', latencyMs: 202 },
  { id: 'as-se', label: 'AS-SE', latencyMs: 156 },
  { id: 'as-ne', label: 'AS-NE', latencyMs: 168 },
  { id: 'au-se', label: 'AU-SE', latencyMs: 189 },
];

export const DEFAULT_BOTTOM_BAR_REGION: BottomBarRegionId = 'us-e';

export function bottomBarRegionById(id: BottomBarRegionId): BottomBarRegion {
  return BOTTOM_BAR_REGIONS.find((r) => r.id === id) ?? BOTTOM_BAR_REGIONS[2]!;
}

export function latencyTone(ms: number): 'good' | 'mid' | 'bad' {
  if (ms <= 50) return 'good';
  if (ms <= 120) return 'mid';
  return 'bad';
}
