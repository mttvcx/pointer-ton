import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PressScale } from './PressScale';
import { colors, radius } from '../src/theme';

export type PickerOption = { label: string; value: string; sub?: string };

/**
 * Validated dropdown/select used by the rule builder for choosing a wallet /
 * token (CA) / @handle, with optional manual entry. Self-contained: uses RN's
 * <Modal> + an animated bottom card, no DragSheet / gesture-handler dependency.
 *
 * Manual entry is gated by `validateManual(trimmed)` — the confirm button stays
 * disabled and a subtle inline error hint shows when the field is non-empty but
 * invalid. Per the locked design rule, all numbers/text use the system font.
 */
export function PickerSheet({
  visible,
  onClose,
  title,
  options,
  onSelect,
  allowManual,
  validateManual,
  manualPlaceholder,
  manualLabel,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: PickerOption[];
  onSelect: (value: string, label: string) => void;
  allowManual?: boolean;
  validateManual?: (s: string) => boolean;
  manualPlaceholder?: string;
  manualLabel?: string;
}) {
  const [manual, setManual] = useState('');
  // `mounted` keeps the Modal alive through the slide/fade-out animation.
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 4 }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 160, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, anim]);

  // Reset the manual field whenever the sheet is freshly opened.
  useEffect(() => {
    if (visible) setManual('');
  }, [visible]);

  const trimmed = manual.trim();
  const manualValid = trimmed.length > 0 && (validateManual ? validateManual(trimmed) : true);
  const showManualError = trimmed.length > 0 && !manualValid;

  const pick = (opt: PickerOption) => {
    onSelect(opt.value, opt.label);
    onClose();
  };

  const confirmManual = () => {
    if (!manualValid) return;
    onSelect(trimmed, trimmed);
    onClose();
  };

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={s.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Backdrop — tap to close */}
        <Pressable style={s.fill} onPress={onClose}>
          <Animated.View style={[s.backdrop, { opacity: anim }]} />
        </Pressable>

        <Animated.View style={[s.cardWrap, { opacity: anim, transform: [{ translateY }] }]} pointerEvents="box-none">
          {/* Stop backdrop taps from bubbling through the card */}
          <Pressable style={s.card} onPress={() => {}}>
            <View style={s.handle} />

            <View style={s.header}>
              <Text style={s.title} numberOfLines={1}>
                {title}
              </Text>
            </View>

            <ScrollView
              style={s.list}
              contentContainerStyle={s.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {options.length === 0 ? (
                <Text style={s.empty}>No options</Text>
              ) : (
                options.map((opt, i) => (
                  <PressScale key={`${opt.value}-${i}`} onPress={() => pick(opt)} style={s.row} to={0.98}>
                    <View style={s.rowText}>
                      <Text style={s.rowLabel} numberOfLines={1}>
                        {opt.label}
                      </Text>
                      {opt.sub ? (
                        <Text style={s.rowSub} numberOfLines={1}>
                          {opt.sub}
                        </Text>
                      ) : null}
                    </View>
                  </PressScale>
                ))
              )}
            </ScrollView>

            {allowManual ? (
              <View style={s.manualBlock}>
                <View style={s.divider} />
                {manualLabel ? <Text style={s.manualLabel}>{manualLabel}</Text> : null}
                <View style={[s.inputWrap, showManualError && s.inputWrapError]}>
                  <TextInput
                    value={manual}
                    onChangeText={setManual}
                    placeholder={manualPlaceholder}
                    placeholderTextColor={colors.fgFaint}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    spellCheck={false}
                    style={s.input}
                    returnKeyType="done"
                    onSubmitEditing={confirmManual}
                  />
                </View>
                {showManualError ? <Text style={s.errorHint}>Not a valid entry</Text> : null}
                <PressScale onPress={confirmManual} style={[s.confirm, !manualValid && s.confirmDisabled]} to={0.97}>
                  <Text style={[s.confirmText, !manualValid && s.confirmTextDisabled]}>Confirm</Text>
                </PressScale>
              </View>
            ) : null}
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)' },
  cardWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  card: {
    backgroundColor: colors.bgRaised,
    borderTopLeftRadius: radius.lg + 6,
    borderTopRightRadius: radius.lg + 6,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
    maxHeight: '82%',
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    marginTop: 2,
    marginBottom: 10,
  },
  header: { paddingBottom: 8 },
  title: { color: colors.fg, fontSize: 17, fontWeight: '700' },
  list: { flexGrow: 0 },
  listContent: { paddingVertical: 4 },
  empty: { color: colors.fgMuted, fontSize: 14, paddingVertical: 24, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgRaised2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 8,
  },
  rowText: { flex: 1 },
  rowLabel: { color: colors.fg, fontSize: 15, fontWeight: '600' },
  rowSub: { color: colors.fgMuted, fontSize: 12.5, marginTop: 2 },
  manualBlock: { marginTop: 4 },
  divider: { height: 1, backgroundColor: colors.border, marginBottom: 14 },
  manualLabel: { color: colors.fgSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  inputWrap: {
    backgroundColor: colors.bgSunken,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 14,
  },
  inputWrapError: { borderColor: colors.bear },
  input: { color: colors.fg, fontSize: 15, paddingVertical: 13 },
  errorHint: { color: colors.bear, fontSize: 12.5, marginTop: 6, marginLeft: 2 },
  confirm: {
    marginTop: 14,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDisabled: { backgroundColor: colors.bgRaised2, borderWidth: 1, borderColor: colors.border },
  confirmText: { color: colors.onAccent, fontSize: 15, fontWeight: '700' },
  confirmTextDisabled: { color: colors.fgFaint },
});
