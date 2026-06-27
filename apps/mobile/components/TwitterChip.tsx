import React, { useState } from 'react';
import { Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { colors, radius } from '../src/theme';

const avatarUri = (seed: string) => `https://api.dicebear.com/9.x/avataaars/png?seed=${encodeURIComponent(seed)}&size=96`;
const isTweet = (v: string) => /\/status\//i.test(v);
function handleOf(v: string): string {
  return (
    v.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, '').split(/[/?#]/)[0] || v
  );
}

/**
 * A token's X link rendered like web: a colored avatar for a PROFILE, a feather
 * for a specific TWEET. Tap opens X; press-and-hold pops an in-app card (the
 * mobile translation of the web hover card). Wire real tweet previews later.
 */
export function TwitterChip({ value, size = 22 }: { value: string; size?: number }) {
  const [card, setCard] = useState(false);
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
        ) : (
          <Image source={{ uri: avatarUri(handle) }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        )}
      </Pressable>

      {card ? (
        <Modal transparent visible animationType="fade" onRequestClose={() => setCard(false)} statusBarTranslucent>
          <Pressable style={s.scrim} onPress={() => setCard(false)}>
            <View style={s.card}>
              <View style={s.cardHead}>
                {tweet ? (
                  <View style={s.cardFeather}>
                    <Feather name="feather" size={18} color={colors.accentGlow} />
                  </View>
                ) : (
                  <Image source={{ uri: avatarUri(handle) }} style={s.cardAvatar} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.cardHandle} numberOfLines={1}>
                    @{handle}
                  </Text>
                  <Text style={s.cardKind}>{tweet ? 'Tweet on X' : 'X profile'}</Text>
                </View>
                <Ionicons name="logo-twitter" size={18} color={colors.fgMuted} />
              </View>
              <Pressable
                style={s.cardBtn}
                onPress={() => {
                  setCard(false);
                  open();
                }}
              >
                <Text style={s.cardBtnText}>Open on X</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}

const s = StyleSheet.create({
  chip: { backgroundColor: colors.bgRaised2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { width: '100%', maxWidth: 360, backgroundColor: colors.bgRaised, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgRaised2 },
  cardFeather: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  cardHandle: { color: colors.fg, fontSize: 17, fontWeight: '800' },
  cardKind: { color: colors.fgMuted, fontSize: 13, marginTop: 1 },
  cardBtn: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  cardBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
