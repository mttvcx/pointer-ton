import React, { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../src/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Collapsible operator-console section. */
export function Accordion({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(170, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    setOpen((v) => !v);
  };
  return (
    <View style={s.wrap}>
      <Pressable onPress={toggle} style={s.header} hitSlop={4}>
        <Text style={s.title}>{title}</Text>
        {badge ? (
          <View style={s.badge}>
            <Text style={s.badgeText}>{badge}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.fgMuted} />
      </Pressable>
      {open ? <View style={s.body}>{children}</View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { borderTopWidth: 1, borderTopColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 15 },
  title: { color: colors.fg, fontSize: 15, fontWeight: '600' },
  badge: { backgroundColor: colors.bgRaised2, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: colors.fgSecondary, fontSize: 11, fontWeight: '600' },
  body: { paddingBottom: 16 },
});
