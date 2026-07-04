import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressScale } from './PressScale';
import { GlassFill } from './GlassFill';
import { GlossButton } from './GlossButton';
import { colors, radius } from '../src/theme';
import { showToast } from '../src/toast';
import { useSquads } from '../src/account';

/**
 * Squads — trading crews. A squad is a GROUP (join a crew, see its combined
 * board), distinct from follow (one-way, notifies you) and friends (mutual).
 *
 * DEMO for now: the squads backend (squads / squad_members tables) isn't
 * provisioned yet, so membership is local + the roster is fixtures. Swap for
 * /api/squads/* once the DB restore + provisioning lands.
 */
type Member = { color: string; initial: string };
type Squad = { id: string; name: string; tag: 'Public' | 'Invite-only'; members: Member[]; memberCount: number; weekPnl: number };

const money = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${Math.round(n)}`);

const M = (color: string, initial: string): Member => ({ color, initial });
const DEMO_SQUADS: Squad[] = [
  { id: 'bunker', name: 'Degen Bunker', tag: 'Invite-only', members: [M('#7A1F1F', 'M'), M('#B5392B', 'C'), M('#6E56CF', 'S'), M('#2E7D32', 'A')], memberCount: 42, weekPnl: 128400 },
  { id: 'moon', name: 'Moon Crew', tag: 'Public', members: [M('#3D3DCF', 'V'), M('#C9A21E', '6'), M('#B5521E', 'm')], memberCount: 128, weekPnl: 512000 },
  { id: 'apes', name: 'Solana Apes', tag: 'Public', members: [M('#1A1A1A', 'C'), M('#9E7B4F', 'C'), M('#F7931A', 'B')], memberCount: 89, weekPnl: 274300 },
  { id: 'quant', name: 'Quant Lab', tag: 'Invite-only', members: [M('#2A2A2A', 'K'), M('#3A2E4A', 'e'), M('#9AA4B2', 'u')], memberCount: 17, weekPnl: 88900 },
];

export function SquadsView() {
  const [joined, setJoined] = useState<Record<string, boolean>>({ bunker: true });
  const yourSquad = DEMO_SQUADS.find((sq) => joined[sq.id]);
  const soon = () => showToast('Squad creation is coming soon', { sub: 'Crews go live with the social update', kind: 'info' });

  // Real squads once any crews exist (table's live now, just empty). Until then
  // the demo roster below stands in so the tab is never blank.
  const real = useSquads().data;
  const realSquads = real?.provisioned ? real.squads : [];

  if (realSquads.length > 0) {
    return (
      <View style={s.wrap}>
        <GlossButton onPress={soon} style={{ marginTop: 4 }}>
          <Ionicons name="add" size={19} color={colors.onAccent} />
          <Text style={s.createText}>Create a squad</Text>
        </GlossButton>
        <View style={s.head}>
          <View style={s.bar} />
          <Text style={s.headText}>Squads</Text>
        </View>
        {realSquads.map((sq) => (
          <View key={sq.id} style={s.row}>
            <GlassFill />
            <View style={s.emoji}>
              <Ionicons name="people" size={20} color={colors.accentGlow} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.nameRow}>
                <Text style={s.name} numberOfLines={1}>{sq.name}</Text>
                {sq.visibility === 'public' ? (
                  <View style={[s.tag, s.tagPublic]}><Text style={[s.tagText, s.tagTextPublic]}>Public</Text></View>
                ) : null}
              </View>
              <Text style={s.meta}>{sq.memberCount} member{sq.memberCount === 1 ? '' : 's'}</Text>
            </View>
            <View style={[s.joinBtn, sq.isMember && s.joinedBtn]}>
              <Text style={[s.joinText, sq.isMember && s.joinedText]}>{sq.isMember ? 'Joined' : 'Join'}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      {yourSquad ? (
        <View style={s.yourCard}>
          <GlassFill active />
          <View style={s.yourTop}>
            <Text style={s.yourLabel}>Your squad</Text>
            <Text style={s.yourWeek}>+{money(yourSquad.weekPnl)} this week</Text>
          </View>
          <Text style={s.yourName}>{yourSquad.name}</Text>
          <View style={s.yourFoot}>
            <Avatars members={yourSquad.members} count={yourSquad.memberCount} />
            <PressScale onPress={() => setJoined((j) => ({ ...j, [yourSquad.id]: false }))} to={0.9} style={s.leaveBtn}>
              <Text style={s.leaveText}>Leave</Text>
            </PressScale>
          </View>
        </View>
      ) : null}

      <GlossButton onPress={soon} style={{ marginTop: yourSquad ? 14 : 4 }}>
        <Ionicons name="add" size={19} color={colors.onAccent} />
        <Text style={s.createText}>Create a squad</Text>
      </GlossButton>

      <View style={s.head}>
        <View style={s.bar} />
        <Text style={s.headText}>Discover squads</Text>
      </View>

      {DEMO_SQUADS.map((sq) => {
        const isIn = Boolean(joined[sq.id]);
        return (
          <View key={sq.id} style={s.row}>
            <GlassFill />
            <View style={s.emoji}>
              <Ionicons name="people" size={20} color={colors.accentGlow} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.nameRow}>
                <Text style={s.name} numberOfLines={1}>
                  {sq.name}
                </Text>
                <View style={[s.tag, sq.tag === 'Public' ? s.tagPublic : s.tagInvite]}>
                  <Text style={[s.tagText, sq.tag === 'Public' ? s.tagTextPublic : s.tagTextInvite]}>{sq.tag}</Text>
                </View>
              </View>
              <Text style={s.meta}>
                {sq.memberCount} members · <Text style={{ color: colors.bull }}>+{money(sq.weekPnl)}</Text> 7d
              </Text>
              <View style={{ marginTop: 8 }}>
                <Avatars members={sq.members} count={sq.memberCount} />
              </View>
            </View>
            <PressScale onPress={() => setJoined((j) => ({ ...j, [sq.id]: !isIn }))} to={0.9} style={[s.joinBtn, isIn && s.joinedBtn]}>
              <Text style={[s.joinText, isIn && s.joinedText]}>{isIn ? 'Joined' : 'Join'}</Text>
            </PressScale>
          </View>
        );
      })}

      <Text style={s.note}>Squads are a preview — crews, combined boards, and squad chat go live with the social update.</Text>
    </View>
  );
}

function Avatars({ members, count }: { members: Member[]; count: number }) {
  const extra = count - members.length;
  return (
    <View style={s.avatars}>
      {members.map((m, i) => (
        <View key={i} style={[s.avatar, { backgroundColor: m.color, marginLeft: i ? -8 : 0 }]}>
          <Text style={s.avatarText}>{m.initial}</Text>
        </View>
      ))}
      {extra > 0 ? (
        <View style={[s.avatar, s.avatarMore, { marginLeft: -8 }]}>
          <Text style={s.avatarMoreText}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 16 },
  yourCard: { borderRadius: radius.lg, padding: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.accent + '55' },
  yourTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  yourLabel: { color: colors.fgMuted, fontSize: 13 },
  yourWeek: { color: colors.bull, fontSize: 13.5, fontWeight: '700' },
  yourName: { color: colors.fg, fontSize: 22, fontWeight: '800', marginTop: 4 },
  yourFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  leaveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  leaveText: { color: colors.fgSecondary, fontSize: 13.5, fontWeight: '700' },

  createText: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },

  head: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 24, marginBottom: 4 },
  bar: { width: 3, height: 16, borderRadius: 2, backgroundColor: colors.accent },
  headText: { color: colors.fg, fontSize: 16, fontWeight: '700' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, padding: 14, marginTop: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  emoji: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: colors.fg, fontSize: 16.5, fontWeight: '700', flexShrink: 1 },
  tag: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  tagPublic: { backgroundColor: colors.bull + '1E' },
  tagInvite: { backgroundColor: colors.bgRaised2 },
  tagText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  tagTextPublic: { color: colors.bull },
  tagTextInvite: { color: colors.fgMuted },
  meta: { color: colors.fgMuted, fontSize: 13, marginTop: 3 },

  joinBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.accent },
  joinedBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  joinText: { color: colors.onAccent, fontSize: 14, fontWeight: '800' },
  joinedText: { color: colors.fgSecondary },

  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  avatarMore: { backgroundColor: colors.bgRaised2 },
  avatarMoreText: { color: colors.fgSecondary, fontSize: 10.5, fontWeight: '700' },

  note: { color: colors.fgFaint, fontSize: 12, lineHeight: 17, marginTop: 20, textAlign: 'center' },
});
