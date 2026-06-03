/** Weekly stakes copy — display only; matches scoring rules in config.ts */

export type WeeklyStakeTier = {
  rank: string;
  placementPts: number;
  wcQp?: number;
  highlight?: boolean;
};

export const PTCS_SOLO_WEEKLY_STAKES: WeeklyStakeTier[] = [
  { rank: '1st', placementPts: 100, wcQp: 100, highlight: true },
  { rank: '2nd', placementPts: 75, wcQp: 75, highlight: true },
  { rank: '3rd', placementPts: 60, wcQp: 60, highlight: true },
  { rank: 'Top 10', placementPts: 40, wcQp: 40 },
  { rank: 'Top 25', placementPts: 25 },
  { rank: 'Top 50', placementPts: 10 },
];

export const PTCS_SQUAD_WEEKLY_STAKES: WeeklyStakeTier[] = [
  { rank: '1st squad', placementPts: 100, wcQp: 100, highlight: true },
  { rank: '2nd squad', placementPts: 75, wcQp: 75, highlight: true },
  { rank: '3rd squad', placementPts: 60, wcQp: 60, highlight: true },
  { rank: 'Top 10', placementPts: 40 },
  { rank: 'Top 25', placementPts: 25 },
];

export const PTCS_STAKES_TAGLINE =
  'Weekly cup · placement bonuses · World Cup qualifier points';
