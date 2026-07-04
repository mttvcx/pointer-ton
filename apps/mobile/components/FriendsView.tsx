import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressScale } from './PressScale';
import { GlassFill } from './GlassFill';
import { colors, radius } from '../src/theme';
import { showToast } from '../src/toast';
import { useFriends, useFriendRequests } from '../src/account';
import { respondFriendRequest } from '../src/api/social';

/**
 * Friends — mutual (both accept), distinct from follow (one-way). Lists incoming
 * requests (accept/decline) + your friends. Wired to /api/social/{friends,
 * friend-requests,friend-respond}; live against prod (tables applied). Sending
 * requests happens from a user's profile once user-discovery lands.
 */
function initialsOf(name: string): string {
  return (name.replace(/^@/, '')[0] || '?').toUpperCase();
}
function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const hues = ['#7A1F1F', '#2E7D32', '#3D3DCF', '#C9A21E', '#6E56CF', '#B5521E', '#1F6E7A'];
  return hues[Math.abs(h) % hues.length];
}

function Avatar({ name }: { name: string }) {
  return (
    <View style={[s.avatar, { backgroundColor: colorFor(name) }]}>
      <Text style={s.avatarText}>{initialsOf(name)}</Text>
    </View>
  );
}

export function FriendsView() {
  const friendsQ = useFriends();
  const reqQ = useFriendRequests();
  const friends = friendsQ.data?.friends ?? [];
  const requests = reqQ.data?.requests ?? [];

  const respond = async (requestId: string, accept: boolean) => {
    try {
      await respondFriendRequest(requestId, accept);
      showToast(accept ? 'Friend added' : 'Request declined', { kind: accept ? 'success' : 'info' });
      reqQ.refetch();
      if (accept) friendsQ.refetch();
    } catch {
      showToast('Couldn’t respond', { kind: 'error' });
    }
  };

  const loading = friendsQ.isLoading || reqQ.isLoading;

  return (
    <View style={s.wrap}>
      {requests.length > 0 ? (
        <>
          <View style={s.head}>
            <View style={s.bar} />
            <Text style={s.headText}>Friend requests</Text>
            <View style={s.badge}>
              <Text style={s.badgeText}>{requests.length}</Text>
            </View>
          </View>
          {requests.map((r) => {
            const name = r.username || (r.twitterHandle ? `@${r.twitterHandle}` : 'Pointer user');
            return (
              <View key={r.requestId} style={s.row}>
                <GlassFill />
                <Avatar name={name} />
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>{name}</Text>
                  {r.twitterHandle ? <Text style={s.sub}>@{r.twitterHandle}</Text> : null}
                </View>
                <PressScale onPress={() => respond(r.requestId, true)} to={0.92} style={s.accept}>
                  <Text style={s.acceptText}>Accept</Text>
                </PressScale>
                <PressScale onPress={() => respond(r.requestId, false)} to={0.9} style={s.decline}>
                  <Ionicons name="close" size={18} color={colors.fgMuted} />
                </PressScale>
              </View>
            );
          })}
        </>
      ) : null}

      <View style={s.head}>
        <View style={s.bar} />
        <Text style={s.headText}>Friends</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : friends.length === 0 ? (
        <View style={s.emptyBox}>
          <GlassFill />
          <Ionicons name="people-outline" size={26} color={colors.fgMuted} />
          <Text style={s.empty}>No friends yet</Text>
          <Text style={s.emptySub}>Accept a request, or add someone from their profile. Friends see each other’s live trades.</Text>
        </View>
      ) : (
        friends.map((f) => {
          const name = f.username || (f.twitterHandle ? `@${f.twitterHandle}` : 'Pointer user');
          return (
            <View key={f.userId} style={s.row}>
              <GlassFill />
              <Avatar name={name} />
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={1}>{name}</Text>
                {f.twitterHandle ? <Text style={s.sub}>@{f.twitterHandle}</Text> : null}
              </View>
              <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
            </View>
          );
        })
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 20, marginBottom: 6 },
  bar: { width: 3, height: 16, borderRadius: 2, backgroundColor: colors.accent },
  headText: { color: colors.fg, fontSize: 16, fontWeight: '700' },
  badge: { backgroundColor: colors.accent, borderRadius: radius.pill, minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, alignItems: 'center' },
  badgeText: { color: colors.onAccent, fontSize: 12, fontWeight: '800' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, padding: 12, marginTop: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  name: { color: colors.fg, fontSize: 15.5, fontWeight: '700' },
  sub: { color: colors.fgMuted, fontSize: 13, marginTop: 1 },
  accept: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 15, paddingVertical: 8 },
  acceptText: { color: colors.onAccent, fontSize: 13.5, fontWeight: '800' },
  decline: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },

  emptyBox: { alignItems: 'center', gap: 6, borderRadius: radius.lg, padding: 24, marginTop: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  empty: { color: colors.fg, fontSize: 16, fontWeight: '700', marginTop: 4 },
  emptySub: { color: colors.fgMuted, fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
