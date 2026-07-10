import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, LayoutAnimation, Modal, PanResponder, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../src/theme';

const WIN_H = Dimensions.get('window').height;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Buttery bottom sheet: springs in, drag the handle down to dismiss (the scrim
 * fades with your finger), drag up to expand to full height. The whole handle row
 * is the grab zone. The scrim + sheet are hand-animated together (Modal fade is
 * off) so there's no dim-flash or freeze on open/close.
 */
export function DragSheet({
  visible,
  onClose,
  children,
  fullDrag = false,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** When true (sheets with no inner scroll), the WHOLE sheet follows the finger,
   *  not just the handle — grab it anywhere and fling it around. */
  fullDrag?: boolean;
}) {
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

  // Where the touch began (page Y) + the sheet's resting top, so we know if a drag
  // started in the top "grip" zone. `fullDrag` = the whole sheet is a grip.
  const startY = useRef(0);
  const sheetTop = useRef(WIN_H);
  const fullDragRef = useRef(fullDrag);
  fullDragRef.current = fullDrag;
  const GRIP = 220; // big grab zone — the whole top of the sheet drags to dismiss/expand

  const pan = useRef(
    PanResponder.create({
      // Record the touch origin but DON'T steal it — taps on buttons still work.
      onStartShouldSetPanResponderCapture: (e) => {
        startY.current = e.nativeEvent.pageY;
        return false;
      },
      // Capture (beats child scroll/buttons) a vertical drag that began in the grip zone.
      onMoveShouldSetPanResponderCapture: (_, g) => {
        if (Math.abs(g.dy) < 5 || Math.abs(g.dy) <= Math.abs(g.dx)) return false;
        return fullDragRef.current || startY.current - sheetTop.current < GRIP;
      },
      onPanResponderMove: (_, g) => {
        if (g.dy >= 0) ty.setValue(g.dy);
        else ty.setValue(tallRef.current ? g.dy * 0.28 : g.dy * 0.5); // livelier rubber-band up
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90 || g.vy > 0.6) {
          close();
          return;
        }
        if (g.dy < -42 && !tallRef.current) setTallBoth(true);
        else if (g.dy > 42 && tallRef.current) setTallBoth(false);
        Animated.spring(ty, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 4 }).start();
      },
      onPanResponderTerminationRequest: () => false,
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
        {...pan.panHandlers}
        onLayout={(e) => {
          const { y, height } = e.nativeEvent.layout;
          if (height > 0) hRef.current = height + 60;
          sheetTop.current = y; // resting top in screen coords (modal is full-screen)
        }}
        style={[
          s.sheet,
          { maxHeight: tall ? WIN_H - insets.top - 6 : Math.round(WIN_H * 0.92), transform: [{ translateY: ty }], paddingBottom: insets.bottom + 14 },
        ]}
      >
        <View style={s.grab}>
          <View style={s.handle} />
          {/* Always-available exit — a scrollable child can swallow the drag gesture,
              so never rely on drag/scrim alone to dismiss. */}
          <Pressable onPress={close} hitSlop={12} style={s.closeBtn}>
            <Ionicons name="close" size={19} color={colors.fgSecondary} />
          </Pressable>
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
  grab: { alignItems: 'center', paddingTop: 14, paddingBottom: 20 },
  handle: { width: 48, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong },
  closeBtn: { position: 'absolute', top: 8, right: 6, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgRaised2 },
});
