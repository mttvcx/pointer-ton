import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Logo } from '../components/Logo';
import { PressScale } from '../components/PressScale';
import { GlassFill } from '../components/GlassFill';
import { ExportKeysSheet } from '../components/ExportKeysSheet';
import { colors, radius } from '../src/theme';
import { useAuth } from '../src/auth';
import { setBio, useBio } from '../src/local';
import { useMe, usePointerIdentity } from '../src/account';
import { saveXUsername } from '../src/api/social';
import { updateProfile } from '../src/api/endpoints';
import { shortMint } from '../src/format';
import { showToast } from '../src/toast';

export function AccountScreen({ autoFocusBio = false }: { autoFocusBio?: boolean }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const me = useMe();
  const xIdentity = usePointerIdentity();
  const storedBio = useBio();
  const [username, setUsername] = useState('');
  const [display, setDisplay] = useState('');
  const [desc, setDesc] = useState(storedBio);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exportSheet, setExportSheet] = useState(false);
  const [exportSignin, setExportSignin] = useState(false);

  // Seed the fields from the real account once it loads (real build).
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current || !me.data) return;
    loaded.current = true;
    setUsername(me.data.username ?? '');
    setDisplay(me.data.username ?? '');
  }, [me.data]);

  const scrollRef = useRef<ScrollView>(null);
  const descRef = useRef<TextInput>(null);
  const descY = useRef(0);
  const dirty = desc.trim() !== storedBio || username.trim() !== (me.data?.username ?? '');

  // Arriving from "Add a bio": land on the description, after the slide settles.
  useEffect(() => {
    if (!autoFocusBio) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, descY.current - 90), animated: true });
      descRef.current?.focus();
    }, 360);
    return () => clearTimeout(t);
  }, [autoFocusBio]);

  const save = async () => {
    setBio(desc.trim());
    // Username persists to the real Pointer account (same as web) via /api/auth/sync.
    const uname = username.trim();
    if (!auth.demo && uname && uname !== (me.data?.username ?? '')) {
      setBusy(true);
      try {
        await updateProfile({ username: uname });
        qc.invalidateQueries({ queryKey: ['me'] });
      } catch (e) {
        setBusy(false);
        Alert.alert('Couldn’t save username', e instanceof Error ? e.message : 'That username may be taken. Try another.');
        return;
      }
      setBusy(false);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
  };

  const connectX = async () => {
    if (auth.demo) {
      showToast('X connect runs in the app build', { kind: 'info' });
      return;
    }
    try {
      const handle = await auth.linkTwitter();
      if (handle) {
        setUsername(handle);
        await updateProfile({ username: handle });
        saveXUsername(handle).catch(() => {});
        qc.invalidateQueries({ queryKey: ['me'] });
        qc.invalidateQueries({ queryKey: ['pointer-identity'] });
        showToast(`Connected @${handle}`, { kind: 'success' });
      }
    } catch {
      showToast('Couldn’t connect X', { kind: 'error' });
    }
  };

  const evm = auth.evmAddress ?? '—';
  const addrs = [
    { label: 'Solana address', value: auth.walletAddress ?? '—' },
    { label: 'Base address', value: evm },
    { label: 'Ethereum address', value: evm },
    { label: 'BNB Chain address', value: evm },
    { label: 'Monad address', value: evm },
  ];

  const xHandle = (xIdentity.data?.xUsername || auth.twitterHandle || '').replace(/^@/, '') || null;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView ref={scrollRef} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={s.h1}>Account</Text>

        {xHandle ? (
          <View style={s.xCard}>
            <View style={[s.xMark, { backgroundColor: colors.accentSoft }]}>
              <Ionicons name="logo-twitter" size={18} color={colors.accentGlow} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.xTitle}>X connected</Text>
              <Text style={s.xSub}>@{xHandle}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
          </View>
        ) : (
          <PressScale to={0.98} style={s.xCard} onPress={connectX}>
            <View style={s.xMark}>
              <Text style={s.xText}>X</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.xTitle}>Connect your X account</Text>
              <Text style={s.xSub}>Claim your username and find friends</Text>
            </View>
            <Ionicons name="arrow-up" size={18} color={colors.accentGlow} style={{ transform: [{ rotate: '45deg' }] }} />
          </PressScale>
        )}

        <View style={s.avatarWrap}>
          <View style={s.avatar}>
            {auth.avatarUrl ? <Image source={{ uri: auth.avatarUrl }} style={s.avatarImg} /> : <Logo size={42} />}
          </View>
          <View style={s.pencil}>
            <Ionicons name="pencil" size={13} color="#fff" />
          </View>
        </View>

        <Text style={s.label}>Username</Text>
        <View style={s.field}>
          <GlassFill />
          <Text style={s.at}>@</Text>
          <TextInput value={username} onChangeText={(t) => setUsername(t.replace(/[^A-Za-z0-9_]/g, '').slice(0, 64))} placeholder="username" placeholderTextColor={colors.fgMuted} style={s.input} autoCapitalize="none" autoCorrect={false} />
        </View>

        <Text style={s.label}>Display name</Text>
        <View style={s.field}>
          <GlassFill />
          <TextInput value={display} onChangeText={setDisplay} style={s.input} />
        </View>

        <View style={s.descHead} onLayout={(e) => (descY.current = e.nativeEvent.layout.y)}>
          <Text style={s.label}>A short description</Text>
          <Text style={s.count}>{desc.length} / 160</Text>
        </View>
        <View style={[s.textarea, autoFocusBio && s.textareaFocus]}>
          <GlassFill />
          <TextInput
            ref={descRef}
            value={desc}
            onChangeText={(t) => setDesc(t.slice(0, 160))}
            style={s.textareaInput}
            placeholder="Describe yourself"
            placeholderTextColor={colors.fgMuted}
            multiline
          />
        </View>

        <PressScale style={[s.save, dirty && s.saveDirty]} onPress={save}>
          <GlassFill active={dirty} />
          <Text style={[s.saveText, dirty && s.saveTextDirty]}>{busy ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}</Text>
        </PressScale>

        <Text style={s.sectionLabel}>Account login</Text>
        <View style={s.loginRow}>
          <Ionicons name="logo-apple" size={20} color={colors.fg} />
          <Text style={s.loginText}>{me.data?.email ?? 'you@privaterelay.appleid.com'}</Text>
        </View>

        <View style={s.divider} />

        {addrs.map((a) => (
          <View key={a.label} style={s.addrBlock}>
            <Text style={s.addrLabel}>{a.label}</Text>
            <View style={s.addrRow}>
              <Text style={s.addr}>{shortMint(a.value)}</Text>
              <Ionicons name="copy-outline" size={15} color={colors.fgMuted} />
            </View>
          </View>
        ))}

        <PressScale style={s.export} onPress={() => setExportSheet(true)}>
          <Text style={s.exportText}>Export</Text>
        </PressScale>
      </ScrollView>

      <ExportKeysSheet
        visible={exportSheet}
        onClose={() => setExportSheet(false)}
        onAcknowledge={() => {
          setExportSheet(false);
          setExportSignin(true);
        }}
      />

      {exportSignin ? (
        <View style={s.signin}>
          <Text style={s.signinBrand}>pointer.</Text>
          <Text style={s.signinSub}>Sign in to export your private key</Text>
          <PressScale style={s.signinBtn} onPress={() => setExportSignin(false)}>
            <Text style={s.signinBtnText}>Login</Text>
          </PressScale>
          <PressScale onPress={() => setExportSignin(false)} hitSlop={10} style={{ marginTop: 16 }}>
            <Text style={s.signinCancel}>Cancel</Text>
          </PressScale>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 60 },
  h1: { color: colors.fg, fontSize: 32, fontWeight: '700', letterSpacing: -0.5, marginBottom: 18 },
  xCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.accentSoft, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.accent, padding: 16 },
  xMark: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' },
  xText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  xTitle: { color: colors.fg, fontSize: 17, fontWeight: '700' },
  xSub: { color: colors.fgSecondary, fontSize: 14, marginTop: 2 },

  avatarWrap: { alignSelf: 'flex-start', marginTop: 26 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E760A0', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 80, height: 80, borderRadius: 40 },
  pencil: { position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: '#1A1E27', borderWidth: 2, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center' },

  label: { color: colors.fgMuted, fontSize: 14, marginTop: 22, marginBottom: 8 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', paddingHorizontal: 16, paddingVertical: 15 },
  at: { color: colors.fgMuted, fontSize: 18, fontWeight: '600' },
  input: { flex: 1, color: colors.fg, fontSize: 18, fontWeight: '500', padding: 0 },
  descHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 8 },
  count: { color: colors.fgMuted, fontSize: 13 },
  textarea: { borderRadius: radius.md, padding: 16, minHeight: 110, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  textareaFocus: { borderColor: colors.accent },
  textareaInput: { color: colors.fg, fontSize: 17, padding: 0, textAlignVertical: 'top', flex: 1 },
  save: { borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginTop: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  saveDirty: { borderColor: 'rgba(255,255,255,0.28)' },
  saveText: { color: colors.fgMuted, fontSize: 16, fontWeight: '700' },
  saveTextDirty: { color: colors.fg },

  sectionLabel: { color: colors.fgMuted, fontSize: 14, marginTop: 26 },
  loginRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  loginText: { color: colors.fg, fontSize: 16, fontWeight: '500' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 22 },
  addrBlock: { marginBottom: 18 },
  addrLabel: { color: colors.fg, fontSize: 18, fontWeight: '700' },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  addr: { color: colors.fgMuted, fontSize: 15 },
  export: { backgroundColor: colors.danger, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 10 },
  exportText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  signin: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  signinBrand: { color: colors.fg, fontSize: 44, fontWeight: '800', letterSpacing: -1 },
  signinSub: { color: colors.fgSecondary, fontSize: 20, fontWeight: '600', textAlign: 'center', marginTop: 16 },
  signinBtn: { alignSelf: 'stretch', backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 17, alignItems: 'center', marginTop: 28 },
  signinBtnText: { color: colors.onAccent, fontSize: 17, fontWeight: '600' },
  signinCancel: { color: colors.fgMuted, fontSize: 15, fontWeight: '600' },
});
