import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../src/theme';
import { clearToast, useToast } from '../src/toast';

/** Mounted once at the app root — slides a toast down from the top on showToast(). */
export function ToastHost() {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const ty = useRef(new Animated.Value(-140)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const idRef = useRef(0);

  useEffect(() => {
    if (!toast) return;
    idRef.current = toast.id;
    ty.setValue(-140);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(ty, { toValue: 0, useNativeDriver: true, speed: 15, bounciness: 7 }),
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(ty, { toValue: -140, duration: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => {
        if (idRef.current === toast.id) clearToast();
      });
    }, 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.id]);

  if (!toast) return null;
  const icon = toast.kind === 'error' ? 'alert-circle' : toast.kind === 'info' ? 'information-circle' : 'checkmark-circle';
  const tint = toast.kind === 'error' ? colors.danger : toast.kind === 'info' ? colors.accentGlow : colors.bull;

  return (
    <Animated.View pointerEvents="none" style={[s.wrap, { top: insets.top + 8, opacity, transform: [{ translateY: ty }] }]}>
      <View style={s.toast}>
        <Ionicons name={icon} size={20} color={tint} />
        <View style={{ flex: 1 }}>
          <Text style={s.msg} numberOfLines={1}>
            {toast.message}
          </Text>
          {toast.sub ? (
            <Text style={s.sub} numberOfLines={1}>
              {toast.sub}
            </Text>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14, zIndex: 1000, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: colors.bgRaised2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 15,
    paddingVertical: 12,
    width: '100%',
    maxWidth: 460,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  msg: { color: colors.fg, fontSize: 15, fontWeight: '700' },
  sub: { color: colors.fgMuted, fontSize: 12.5, marginTop: 1 },
});
