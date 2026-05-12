import type { DemoTrader } from '@/lib/squads/demo';
import type { DemoSquad } from '@/lib/squads/demo';

export function seedFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic “live” secondary stats for trader cards — stable per handle, no extra API. */
export function traderDirectoryMeta(t: DemoTrader) {
  const x = seedFromString(t.id + t.handle);
  const winRatePct = 51 + (x % 23);
  const activeDays = 74 + (x % 380);
  const watchedVenues = Math.min(12, t.chainTags.length + (x % 5));
  const lastActive = ['Live · 12m', 'Active · 2h', 'Seen · 6h', 'Seen · 1d'][x % 4];

  return {
    winRatePct,
    activeDays,
    watchedVenues,
    lastActive,
    squadsJoined: Math.max(1, t.mutualSquads + ((x >> 3) % 4)),
  };
}

export function lfsCardMeta(t: DemoTrader) {
  const x = seedFromString(`${t.handle}:lfs`);
  const response = ['Usually < 4h', '< 24h', 'Weekdays · fast'][x % 3];
  const roomPref =
    t.operatorLevel === 'high'
      ? x % 2 === 0
        ? 'Private · invite-first'
        : 'Request-to-join desks'
      : x % 2 === 0
        ? 'Structured public rooms'
        : 'Small operator pods';

  return { response, roomPref };
}

/** Room-card rhythm lines derived from slug — stable demo polish for recruit / my squads. */
export function squadRoomCardMeta(s: DemoSquad) {
  const x = seedFromString(`${s.slug}:room`);
  const lastActive = ['Live · desks active', 'Pulse · hot thread', 'Sync · steady'][x % 3];
  const spotlight =
    s.signalGrade === 'high' && s.visibility === 'invite_only'
      ? ('invite_high' as const)
      : s.signalGrade === 'high'
        ? ('featured' as const)
        : ('standard' as const);

  return {
    lastActive,
    spotlight,
    pulseLine: `${s.recentActivityCount}+ updates · 24h`,
  };
}
