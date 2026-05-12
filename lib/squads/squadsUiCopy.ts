/** Product copy for Squads hub — route-keyed subtitles (no dev scaffolding). */

export const SQUADS_SECTION_SUBTITLE: Record<string, string> = {
  '/squads/discover-traders': 'Find trusted traders, join elite rooms, and coordinate in real time.',
  '/squads/recruit': 'Apply to elite rooms and recruit trusted operators.',
  '/squads/looking': 'Broadcast that you’re open to joining the right room.',
  '/squads/my': 'Rooms you operate in—access, pinned context, shared flow.',
  '/squads/inbox': 'Manage room invites, applications, and membership requests.',
  '/squads/reputation': 'Choose which identity and reputation fields other traders can see.',
};

export function squadsSubtitleForPath(pathname: string | null): string {
  if (!pathname?.startsWith('/squads')) return SQUADS_SECTION_SUBTITLE['/squads/discover-traders']!;
  if (pathname.startsWith('/squads/room/')) return SQUADS_SECTION_SUBTITLE['/squads/my']!;
  const hit = SQUADS_SECTION_SUBTITLE[pathname];
  if (hit) return hit;
  return SQUADS_SECTION_SUBTITLE['/squads/discover-traders']!;
}
