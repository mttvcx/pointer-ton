import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DragSheet } from './DragSheet';
import { PressScale } from './PressScale';
import { GlassFill } from './GlassFill';
import { MetalButton } from './MetalButton';
import { colors, radius } from '../src/theme';
import { showToast } from '../src/toast';

// Pointer's own concierge team (support specialists, not traders) — initials
// avatars so we never imply a fake identity.
const TEAM = [
  { initial: 'M', color: '#8A6FE8' },
  { initial: 'R', color: '#3E9C7A' },
  { initial: 'K', color: '#C6893F' },
];

const TOPICS: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; sub: string }[] = [
  { icon: 'card-outline', label: 'Card & spending', sub: 'Limits, freezes, disputes' },
  { icon: 'trending-up-outline', label: 'Moving large size', sub: 'White-glove OTC & routing' },
  { icon: 'airplane-outline', label: 'Travel & lounges', sub: 'Access, benefits, bookings' },
  { icon: 'shield-checkmark-outline', label: 'Account & security', sub: 'Verification, recovery' },
];

/**
 * Concierge — the premium human-support entry (a Gold/Platinum perk). Priority
 * 24/7 line. Messaging isn't live yet, so the CTA is an honest "we'll be in
 * touch" rather than a fake open chat.
 */
export function ConciergeSheet({
  visible,
  onClose,
  unlocked,
  onUpgrade,
}: {
  visible: boolean;
  onClose: () => void;
  unlocked: boolean;
  onUpgrade: () => void;
}) {
  return (
    <DragSheet visible={visible} onClose={onClose} fullDrag>
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.avatars}>
          {TEAM.map((t, i) => (
            <View key={t.initial} style={[s.avatar, { backgroundColor: t.color, marginLeft: i === 0 ? 0 : -12 }]}>
              <Text style={s.avatarText}>{t.initial}</Text>
            </View>
          ))}
          <View style={s.onlineDot} />
        </View>

        <Text style={s.title}>Concierge</Text>
        <Text style={s.sub}>A dedicated team, on call 24/7. Real people — no bots, no queues.</Text>

        <View style={s.topics}>
          {TOPICS.map((t, i) => (
            <PressScale
              key={t.label}
              to={0.98}
              onPress={() =>
                unlocked
                  ? showToast('Your concierge will reach out shortly', { sub: t.label, kind: 'success' })
                  : onUpgrade()
              }
              style={[s.topic, i > 0 && s.topicBorder]}
            >
              <View style={s.topicIcon}>
                <Ionicons name={t.icon} size={18} color="#D2D8DE" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.topicLabel}>{t.label}</Text>
                <Text style={s.topicSub}>{t.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.fgMuted} />
            </PressScale>
          ))}
        </View>

        {unlocked ? (
          <MetalButton onPress={() => { showToast('Your concierge will reach out shortly', { kind: 'success' }); onClose(); }} style={{ marginTop: 20 }}>
            <Ionicons name="chatbubbles" size={18} color="#0A0C10" />
            <Text style={s.cta}>Message concierge</Text>
          </MetalButton>
        ) : (
          <>
            <View style={s.lockNote}>
              <Ionicons name="lock-closed" size={13} color={colors.fgMuted} />
              <Text style={s.lockText}>Concierge unlocks with a paid membership.</Text>
            </View>
            <MetalButton onPress={onUpgrade} style={{ marginTop: 12 }}>
              <Ionicons name="ribbon" size={18} color="#0A0C10" />
              <Text style={s.cta}>See membership</Text>
            </MetalButton>
          </>
        )}
      </ScrollView>
    </DragSheet>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 12, alignItems: 'center' },
  avatars: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bgRaised },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  onlineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.bull, marginLeft: 8, borderWidth: 2, borderColor: colors.bgRaised },
  title: { color: colors.fg, fontSize: 24, fontWeight: '800', marginTop: 16 },
  sub: { color: colors.fgSecondary, fontSize: 14.5, lineHeight: 21, textAlign: 'center', marginTop: 8, paddingHorizontal: 10 },
  topics: { alignSelf: 'stretch', borderRadius: radius.md, backgroundColor: colors.bgRaised2, marginTop: 22, paddingHorizontal: 14 },
  topic: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14 },
  topicBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  topicIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(199,204,209,0.10)', alignItems: 'center', justifyContent: 'center' },
  topicLabel: { color: colors.fg, fontSize: 15, fontWeight: '700' },
  topicSub: { color: colors.fgMuted, fontSize: 12.5, marginTop: 1 },
  cta: { color: '#0A0C10', fontSize: 16, fontWeight: '700' },
  lockNote: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 18 },
  lockText: { color: colors.fgMuted, fontSize: 13 },
});
