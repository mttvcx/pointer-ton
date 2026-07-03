import React, { useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { getTwitterProfile } from '../src/api/endpoints';
import { xAvatarUrl, compactCount } from '../src/social';
import { colors, radius } from '../src/theme';

/** Clean neutral avatar shown when a token's X handle has no resolvable photo. */
const X_FALLBACK = require('../assets/x-avatar-fallback.png');

const isTweet = (v: string) => /\/status\//i.test(v);
function handleOf(v: string): string {
  return (
    v.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, '').split(/[/?#]/)[0] || v
  );
}

/**
 * A token's X link rendered like web: a REAL profile avatar (unavatar by handle)
 * for a PROFILE, a feather for a specific TWEET. Tap opens X; press-and-hold pops
 * a rich profile card (mobile translation of the web Twitter hover card) that
 * fetches the real name / bio / follower counts and never shows fake numbers.
 */
export function TwitterChip({ value, size = 22, forceIcon = false }: { value: string; size?: number; forceIcon?: boolean }) {
  const [card, setCard] = useState(false);
  const [failed, setFailed] = useState(false);
  const tweet = isTweet(value);
  const handle = handleOf(value);
  const url = tweet ? value : `https://x.com/${handle}`;
  const open = () => Linking.openURL(url).catch(() => undefined);

  return (
    <>
      <Pressable
        onPress={open}
        onLongPress={() => setCard(true)}
        delayLongPress={220}
        hitSlop={6}
        style={[s.chip, { width: size, height: size, borderRadius: size / 2 }]}
      >
        {tweet ? (
          <Feather name="feather" size={Math.round(size * 0.58)} color={colors.accentGlow} />
        ) : failed || forceIcon ? (
          <Image source={X_FALLBACK} style={{ width: size, height: size }} resizeMode="contain" />
        ) : (
          <Image
            source={{ uri: xAvatarUrl(handle) }}
            onError={() => setFailed(true)}
            style={{ width: size, height: size, borderRadius: size / 2 }}
          />
        )}
      </Pressable>

      {card ? <ProfileHoldCard handle={handle} tweet={tweet} url={url} onClose={() => setCard(false)} /> : null}
    </>
  );
}

function ProfileHoldCard({
  handle,
  tweet,
  url,
  onClose,
}: {
  handle: string;
  tweet: boolean;
  url: string;
  onClose: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const open = () => {
    onClose();
    Linking.openURL(url).catch(() => undefined);
  };
  const q = useQuery({
    queryKey: ['x-profile', handle],
    queryFn: () => getTwitterProfile(handle),
    enabled: !tweet,
    staleTime: 5 * 60_000,
    retry: 0,
  });
  const p = q.data;
  const name = (p?.displayName ?? '').trim() || handle;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.scrim} onPress={onClose}>
        {/* Inner press swallows taps so touching the card doesn't dismiss it. */}
        <Pressable style={s.card} onPress={() => undefined}>
          <View style={s.banner} />
          <View style={s.body}>
            <View style={s.headRow}>
              {tweet ? (
                <View style={[s.avatar, s.avatarFeather]}>
                  <Feather name="feather" size={24} color={colors.accentGlow} />
                </View>
              ) : failed ? (
                <Image source={X_FALLBACK} style={[s.avatar, s.avatarFallback]} resizeMode="contain" />
              ) : (
                <Image source={{ uri: xAvatarUrl(handle) }} onError={() => setFailed(true)} style={s.avatar} />
              )}
              <View style={{ flex: 1 }} />
              <Pressable style={s.openPill} onPress={open}>
                <Ionicons name="logo-twitter" size={13} color={colors.fg} />
                <Text style={s.openPillText}>Open</Text>
              </Pressable>
            </View>

            <View style={s.nameRow}>
              <Text style={s.name} numberOfLines={1}>
                {tweet ? 'Tweet' : name}
              </Text>
              {p?.verified ? <Ionicons name="checkmark-circle" size={16} color={colors.accentGlow} /> : null}
            </View>
            <Text style={s.handle}>@{handle}</Text>

            {tweet ? (
              <Text style={s.kind}>Posted on X</Text>
            ) : q.isLoading ? (
              <View style={s.loadingRow}>
                <ActivityIndicator size="small" color={colors.fgMuted} />
                <Text style={s.kind}>Loading profile…</Text>
              </View>
            ) : p ? (
              <>
                {p.bio ? (
                  <Text style={s.bio} numberOfLines={3}>
                    {p.bio}
                  </Text>
                ) : null}
                <View style={s.stats}>
                  <Text style={s.stat}>
                    <Text style={s.statN}>{compactCount(p.followingCount)}</Text> Following
                  </Text>
                  <Text style={s.stat}>
                    <Text style={s.statN}>{compactCount(p.followerCount)}</Text> Followers
                  </Text>
                </View>
              </>
            ) : (
              <Text style={s.kind}>X profile</Text>
            )}

            <Pressable style={s.cta} onPress={open}>
              <Text style={s.ctaText}>Open on X</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const AVATAR = 58;

const s = StyleSheet.create({
  chip: { backgroundColor: colors.bgRaised2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },

  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.bgRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  banner: { height: 60, backgroundColor: colors.accentSoft },
  body: { paddingHorizontal: 16, paddingBottom: 16, gap: 4 },
  headRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: -AVATAR / 2, marginBottom: 6 },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: colors.bgRaised2,
    borderWidth: 3,
    borderColor: colors.bgRaised,
  },
  avatarFeather: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  avatarFallback: { backgroundColor: colors.bgRaised2 },
  openPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.bgRaised2,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 4,
  },
  openPillText: { color: colors.fg, fontSize: 12.5, fontWeight: '700' },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { color: colors.fg, fontSize: 18, fontWeight: '800', flexShrink: 1 },
  handle: { color: colors.fgMuted, fontSize: 13.5, marginTop: 0 },
  kind: { color: colors.fgFaint, fontSize: 12.5, marginTop: 4 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  bio: { color: colors.fgSecondary, fontSize: 13.5, lineHeight: 19, marginTop: 8 },
  stats: { flexDirection: 'row', gap: 18, marginTop: 10 },
  stat: { color: colors.fgMuted, fontSize: 13 },
  statN: { color: colors.fg, fontWeight: '800' },

  cta: { marginTop: 14, backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  ctaText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
});
