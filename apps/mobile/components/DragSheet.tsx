import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutAnimation, Modal, PanResponder, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../src/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Buttery bottom sheet: springs in, drag the handle down to dismiss (the scrim
 * fades with your finger), drag up to expand to full height. The whole handle row
 * is the grab zone. The scrim + sheet are hand-animated together (Modal fade is
 * off) so there's no dim-flash or freeze on open/close.
 */
export function DragSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const ty = useRef(new Animated.Value(900)).current;
  const [tall, setTall] = useState(false);
  const tallRef = useRef(false);
  const hRef = useRef(700);

  const setTallBoth = (v: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(200, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.scaleXY));
    tallRef.current = v;
    setTall(v);
  };

  useEffect(() => {
    if (visible) {
      tallRef.current = false;
      setTall(false);
      ty.setValue(hRef.current);
      Animated.spring(ty, { toValue: 0, useNativeDriver: true, speed: 17, bounciness: 4 }).start();
    }
  }, [visible]);

  const close = () =>
    Animated.timing(ty, { toValue: hRef.current, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (finished) onClose();
    });

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx) * 1.3,
      onPanResponderMove: (_, g) => {
        if (g.dy >= 0) ty.setValue(g.dy);
        else ty.setValue(tallRef.current ? 0 : g.dy * 0.26); // rubber-band up; clamp once already tall
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 0.8) {
          close();
          return;
        }
        if (g.dy < -42 && !tallRef.current) setTallBoth(true);
        else if (g.dy > 42 && tallRef.current) setTallBoth(false);
        Animated.spring(ty, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 4 }).start();
      },
    }),
  ).current;

  if (!visible) return null;

  const scrimOpacity = ty.interpolate({ inputRange: [0, 360], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <Modal transparent visible animationType="none" onRequestClose={close} statusBarTranslucent>
      <Animated.View style={[s.scrim, { opacity: scrimOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>
      <Animated.View
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0) hRef.current = h + 60;
        }}
        style={[s.sheet, { maxHeight: tall ? '94%' : '86%', transform: [{ translateY: ty }], paddingBottom: insets.bottom + 14 }]}
      >
        <View {...pan.panHandlers} style={s.grab}>
          <View style={s.handle} />
        </View>
        {children}
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  grab: { alignItems: 'center', paddingTop: 12, paddingBottom: 14 },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong },
});
