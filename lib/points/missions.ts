/**
 * Daily Missions — a friendlier face on the points events. Each mission maps to
 * a points_events `event_type`; "done" = the user logged that event today (UTC).
 * The points are already awarded by the underlying event, so missions are a
 * display/motivation layer, not a separate award path.
 */
export type MissionDef = {
  id: string;
  label: string;
  hint: string;
  /** points_events.event_type counted for today. */
  eventType: string;
  target: number;
  /** base reward (UI scales it up like every other points number). */
  reward: number;
};

export const DAILY_MISSIONS: MissionDef[] = [
  { id: 'checkin', label: 'Daily check-in', hint: 'Open Pointer today', eventType: 'daily_login', target: 1, reward: 50 },
  { id: 'shot', label: 'Take a shot', hint: 'Make at least one trade today', eventType: 'trade_volume', target: 1, reward: 25 },
  { id: 'grind', label: 'On the grind', hint: 'Make 3 trades today', eventType: 'trade_volume', target: 3, reward: 60 },
  { id: 'refer', label: 'Bring a degen', hint: 'Refer someone who trades', eventType: 'referral_volume', target: 1, reward: 100 },
  { id: 'share', label: 'Spread the word', hint: 'Share Pointer on X', eventType: 'social_share', target: 1, reward: 150 },
];

export type MissionProgress = {
  id: string;
  label: string;
  hint: string;
  target: number;
  progress: number;
  done: boolean;
  reward: number;
};
