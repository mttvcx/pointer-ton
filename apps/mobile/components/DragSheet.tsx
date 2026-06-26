import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutAnimation, Modal, PanResponder, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../src/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Bottom sheet: drag the top down to dismiss, drag up to expand to full height
 * (snaps between the two), or tap the scrim. The grab zone is the whole handle
 * row so it's easy to catch.
 */
export function DragSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const ty = useRef(new Animated.Value(1000)).current;
  const [tall, setTall] = useState(false);
  const tallRef = useRef(false);

  const setTallBoth = (v: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    tallRef.current = v;
    setTall(v);
  };

  useEffect(() => {
    if (visible) {
      tallRef.current = false;
      setTall(false);
      ty.setValue(1000);
      Animated.spring(ty, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 2 }).start();
    }
  }, [visible]);

  const close = () => Animated.timing(ty, { toValue: 1000, duration: 220, useNativeDriver: true }).start(() => onClose());

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) ty.setValue(g.dy);
        else if (g.dy < 0 && !tallRef.current) ty.setValue(g.dy * 0.3);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 130 || g.vy > 0.7) {
          close();
          return;
        }
        if (g.dy < -45) setTallBoth(true);
        else if (g.dy > 45 && tallRef.current) setTallBoth(false);
        Animated.spring(ty, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 3 }).start();
      },
    }),
  ).current;

  if (!visible) return null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={close} statusBarTranslucent>
      <Pressable style={s.scrim} onPress={close} />
      <Animated.View style={[s.sheet, { maxHeight: tall ? '94%' : '85%', transform: [{ translateY: ty }], paddingBottom: insets.bottom + 14 }]}>
        <View {...pan.panHandlers} style={s.grab}>
          <View style={s.handle} />
        </View>
        {children}
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  grab: { alignItems: 'center', paddingTop: 12, paddingBottom: 16 },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong },
});
