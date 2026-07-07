import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { DragSheet } from './DragSheet';
import { PressScale } from './PressScale';
import { MetalButton } from './MetalButton';
import { VisaMark } from './VisaMark';
import { CardShine } from './CardShine';
import { Logo } from './Logo';
import { colors, radius } from '../src/theme';
import { usd, group } from '../src/format';
import { showToast } from '../src/toast';
import {
  useCards, createCard, renameCard, setCardFrozen, toggleFavourite, setCardLimit, removeCard,
  CATEGORY_META, CARD_CATEGORIES, type PointerCard, type CardCategory,
} from '../src/financial/cards';
import { useTier } from '../src/financial/credit';
import { tierById, CATEGORY_META as SPEND_CATEGORY_META } from '../src/financial/tiers';
import { categoryForTxn } from '../src/financial/cashback';

type CardView = { k: 'list' } | { k: 'manage'; id: string } | { k: 'create' };
type IonName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Pointer Cards — one card per purpose (Travel, Groceries, Subs…). List view
 * (Favourites / All), a per-card management screen (freeze, nickname, limit,
 * favourite, details, spend tracker, transactions) and a create flow. All cards
 * wear the user's tier metal, so the whole thing reads silver/chrome, not white.
 */
export function CardsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const cards = useCards();
  const [view, setView] = useState<CardView>({ k: 'list' });
  const gradient = tierById(useTier()).gradient;
  const ink = faceInk(gradient);

  const close = () => {
    setView({ k: 'list' });
    onClose();
  };

  const managed = view.k === 'manage' ? cards.find((c) => c.id === view.id) ?? null : null;

  return (
    <DragSheet visible={visible} onClose={close} fullDrag>
      {view.k === 'list' ? (
        <CardList cards={cards} gradient={gradient} onOpen={(id) => setView({ k: 'manage', id })} onCreate={() => setView({ k: 'create' })} />
      ) : view.k === 'create' ? (
        <CreateCard
          gradient={gradient}
          onBack={() => setView({ k: 'list' })}
          onCreated={(id) => setView({ k: 'manage', id })}
        />
      ) : managed ? (
        <ManageCard
          card={managed}
          gradient={gradient}
          ink={ink}
          onBack={() => setView({ k: 'list' })}
          onDeleted={() => setView({ k: 'list' })}
        />
      ) : null}
    </DragSheet>
  );
}

/* ── List ─────────────────────────────────────────────── */

function CardList({ cards, gradient, onOpen, onCreate }: { cards: PointerCard[]; gradient: [string, string]; onOpen: (id: string) => void; onCreate: () => void }) {
  const favs = cards.filter((c) => c.favourite);
  const rest = cards.filter((c) => !c.favourite);

  return (
    <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
      <View style={s.listHead}>
        <Text style={s.title}>Cards</Text>
        <PressScale to={0.94} onPress={onCreate} style={s.newBtn}>
          <Ionicons name="add" size={18} color="#0A0C10" />
        </PressScale>
      </View>

      {favs.length ? (
        <>
          <Text style={s.section}>Favourites</Text>
          {favs.map((c) => <CardRow key={c.id} card={c} gradient={gradient} onPress={() => onOpen(c.id)} />)}
        </>
      ) : null}

      <Text style={s.section}>All cards</Text>
      {rest.map((c) => <CardRow key={c.id} card={c} gradient={gradient} onPress={() => onOpen(c.id)} />)}

      <PressScale to={0.98} onPress={onCreate} style={s.createRow}>
        <View style={s.createIcon}>
          <Ionicons name="add" size={20} color="#D2D8DE" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.createTitle}>New card</Text>
          <Text style={s.createSub}>A card for travel, subs, groceries…</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.fgMuted} />
      </PressScale>

      <Text style={s.foot}>Every card draws on one non-custodial balance — spin up as many as you like, no new account.</Text>
    </ScrollView>
  );
}

function CardRow({ card, gradient, onPress }: { card: PointerCard; gradient: [string, string]; onPress: () => void }) {
  return (
    <PressScale to={0.98} onPress={onPress} style={s.row}>
      <CardThumb card={card} gradient={gradient} />
      <View style={{ flex: 1 }}>
        <Text style={s.rowName} numberOfLines={1}>{card.nickname}</Text>
        <Text style={s.rowSub} numberOfLines={1}>•••• {card.last4} · {CATEGORY_META[card.category].label}</Text>
      </View>
      {card.frozen ? <Ionicons name="snow" size={15} color={colors.brand} style={{ marginRight: 6 }} /> : null}
      {card.favourite ? <Ionicons name="star" size={14} color="#D2D8DE" style={{ marginRight: 6 }} /> : null}
      <Ionicons name="chevron-forward" size={16} color={colors.fgMuted} />
    </PressScale>
  );
}

function CardThumb({ card, gradient }: { card: PointerCard; gradient: [string, string] }) {
  return (
    <View style={[s.thumb, card.frozen && { opacity: 0.5 }]}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={s.thumbEdge} pointerEvents="none" />
      <Ionicons name={CATEGORY_META[card.category].icon as any} size={16} color="rgba(10,12,16,0.7)" />
    </View>
  );
}

/* ── Manage ───────────────────────────────────────────── */

function ManageCard({ card, gradient, ink, onBack, onDeleted }: { card: PointerCard; gradient: [string, string]; ink: string; onBack: () => void; onDeleted: () => void }) {
  const [edit, setEdit] = useState<'nickname' | 'limit' | 'details' | null>(null);
  const tier = tierById(useTier());
  const pct = card.monthlyLimit > 0 ? Math.min(1, card.spentThisMonth / card.monthlyLimit) : 0;
  const over = card.monthlyLimit > 0 && card.spentThisMonth >= card.monthlyLimit;

  const actions = [
    { key: 'freeze', label: card.frozen ? 'Unfreeze' : 'Freeze', icon: (card.frozen ? 'sunny-outline' : 'snow-outline') as IonName, on: () => { setCardFrozen(card.id, !card.frozen); showToast(card.frozen ? 'Card unfrozen' : 'Card frozen', { kind: 'success' }); } },
    { key: 'nickname', label: 'Nickname', icon: 'create-outline' as IonName, on: () => setEdit(edit === 'nickname' ? null : 'nickname') },
    { key: 'limit', label: 'Limit', icon: 'speedometer-outline' as IonName, on: () => setEdit(edit === 'limit' ? null : 'limit') },
    { key: 'fav', label: card.favourite ? 'Favourited' : 'Favourite', icon: (card.favourite ? 'star' : 'star-outline') as IonName, on: () => toggleFavourite(card.id) },
    { key: 'details', label: 'Details', icon: 'card-outline' as IonName, on: () => setEdit(edit === 'details' ? null : 'details') },
  ];

  return (
    <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
      <View style={s.mHead}>
        <PressScale to={0.9} onPress={onBack} style={s.backBtn}><Ionicons name="chevron-back" size={22} color={colors.fgSecondary} /></PressScale>
        <Text style={s.mTitle} numberOfLines={1}>{card.nickname}</Text>
        <View style={s.backBtn} />
      </View>

      <CardFace card={card} gradient={gradient} ink={ink} />

      {/* circular action row */}
      <View style={s.actions}>
        {actions.map((a) => (
          <View key={a.key} style={s.action}>
            <PressScale to={0.9} onPress={a.on} style={s.actionBtn}>
              <LinearGradient colors={['#EDF0F3', '#C4CBD2', '#9BA3AC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <LinearGradient colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.actionSheen} pointerEvents="none" />
              <Ionicons name={a.icon} size={19} color="#0A0C10" />
            </PressScale>
            <Text style={s.actionLabel} numberOfLines={1}>{a.label}</Text>
          </View>
        ))}
      </View>

      {/* inline editors */}
      {edit === 'nickname' ? (
        <NicknameEditor card={card} onDone={() => setEdit(null)} />
      ) : edit === 'limit' ? (
        <LimitEditor card={card} onDone={() => setEdit(null)} />
      ) : edit === 'details' ? (
        <DetailsPanel card={card} />
      ) : null}

      {/* spend tracker */}
      <View style={s.tracker}>
        <View style={s.trackerTop}>
          <Text style={s.trackerLabel}>Spending this month</Text>
          <Text style={[s.trackerLeft, over && { color: colors.bear }]}>
            {card.monthlyLimit > 0 ? `${usd(Math.max(0, card.monthlyLimit - card.spentThisMonth), 0)} left` : 'No limit'}
          </Text>
        </View>
        {card.monthlyLimit > 0 ? (
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: over ? colors.bear : '#C7CCD1' }]} />
          </View>
        ) : null}
        <View style={s.tiles}>
          <View style={s.tile}>
            <Text style={s.tileLabel}>Spent on this card</Text>
            <Text style={s.tileVal}>{usd(card.spentThisMonth)}</Text>
            <Text style={s.tileSub}>this month</Text>
          </View>
          <View style={s.tile}>
            <Text style={s.tileLabel}>Monthly limit</Text>
            <Text style={s.tileVal}>{card.monthlyLimit > 0 ? usd(card.monthlyLimit, 0) : '—'}</Text>
            <Text style={s.tileSub}>{card.monthlyLimit > 0 ? `${Math.round(pct * 100)}% used` : 'Tap Limit to set'}</Text>
          </View>
        </View>
      </View>

      {/* transactions */}
      <Text style={s.section}>Spends</Text>
      {card.spends.length ? (
        card.spends.map((t) => {
          const cat = categoryForTxn({ merchant: t.merchant });
          const boostRate = cat !== 'base' ? tier.boosts[cat].rate : 0;
          return (
            <View key={t.id} style={s.txn}>
              <View style={s.txnIcon}><Ionicons name={t.icon as any} size={17} color={colors.fgSecondary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.txnMerchant} numberOfLines={1}>{t.merchant}</Text>
                <View style={s.txnMetaRow}>
                  <Text style={s.txnWhen}>{t.when}</Text>
                  {cat !== 'base' ? (
                    <View style={s.txnCat}>
                      <Ionicons name={SPEND_CATEGORY_META[cat].icon as any} size={9} color={colors.bull} />
                      <Text style={s.txnCatText}>{boostRate}% {SPEND_CATEGORY_META[cat].label}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <Text style={s.txnAmt}>-{usd(t.amount)}</Text>
            </View>
          );
        })
      ) : (
        <Text style={s.empty}>No spends yet on this card.</Text>
      )}

      <PressScale to={0.98} onPress={() => { removeCard(card.id); showToast('Card deleted', { kind: 'info' }); onDeleted(); }} style={s.delete}>
        <Ionicons name="trash-outline" size={16} color={colors.bear} />
        <Text style={s.deleteText}>Delete card</Text>
      </PressScale>
    </ScrollView>
  );
}

function CardFace({ card, gradient, ink }: { card: PointerCard; gradient: [string, string]; ink: string }) {
  const light = ink === '#0A0C10';
  return (
    <View style={[s.face, card.frozen && { opacity: 0.72 }]}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={light ? ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.28)', 'rgba(0,0,0,0.06)'] : ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.12)', 'rgba(0,0,0,0.1)']}
        locations={[0, 0.42, 0.66, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <CardShine intensity={light ? 0.5 : 0.32} />
      <View style={s.faceEdge} pointerEvents="none" />
      <View style={s.faceTop}>
        <View style={s.faceBrand}>
          <Logo size={17} style={{ tintColor: ink }} />
          <Text style={[s.faceBrandText, { color: ink }]}>pointer.</Text>
        </View>
        <Text style={[s.faceNick, { color: ink }]} numberOfLines={1}>{card.nickname}</Text>
      </View>
      <View style={s.faceNumRow}>
        <Text style={[s.faceNum, { color: ink }]}>4242  ••••  ••••  {card.last4}</Text>
      </View>
      <View style={s.faceBottom}>
        <Text style={[s.faceMode, { color: ink }]}>{card.frozen ? 'FROZEN' : 'CREDIT'}</Text>
        <VisaMark size={22} tint={ink} style={{ opacity: 0.92 }} />
      </View>
      {card.frozen ? (
        <View style={s.frozenBadge}>
          <Ionicons name="snow" size={14} color="#fff" />
        </View>
      ) : null}
    </View>
  );
}

function NicknameEditor({ card, onDone }: { card: PointerCard; onDone: () => void }) {
  const [v, setV] = useState(card.nickname);
  return (
    <View style={s.editor}>
      <Text style={s.editorLabel}>Card nickname</Text>
      <TextInput value={v} onChangeText={setV} style={s.editorInput} placeholder="e.g. For Travel" placeholderTextColor={colors.fgFaint} autoFocus maxLength={22} />
      <MetalButton onPress={() => { renameCard(card.id, v); showToast('Nickname updated', { kind: 'success' }); onDone(); }} style={{ marginTop: 12 }}>
        <Text style={s.editorCta}>Save nickname</Text>
      </MetalButton>
    </View>
  );
}

function LimitEditor({ card, onDone }: { card: PointerCard; onDone: () => void }) {
  const [v, setV] = useState(card.monthlyLimit ? String(card.monthlyLimit) : '');
  const presets = [500, 1000, 2000, 5000];
  return (
    <View style={s.editor}>
      <Text style={s.editorLabel}>Monthly spend limit</Text>
      <View style={s.limitInputRow}>
        <Text style={s.limitDollar}>$</Text>
        <TextInput value={v} onChangeText={(t) => setV(t.replace(/[^0-9]/g, ''))} style={s.limitInput} placeholder="0" placeholderTextColor={colors.fgFaint} keyboardType="number-pad" autoFocus />
      </View>
      <View style={s.presetRow}>
        {presets.map((p) => (
          <PressScale key={p} to={0.94} onPress={() => setV(String(p))} style={s.preset}>
            <Text style={s.presetText}>{usd(p, 0)}</Text>
          </PressScale>
        ))}
        <PressScale to={0.94} onPress={() => setV('')} style={s.preset}>
          <Text style={s.presetText}>None</Text>
        </PressScale>
      </View>
      <MetalButton onPress={() => { setCardLimit(card.id, Number(v) || 0); showToast(v ? `Limit set to ${usd(Number(v), 0)}/mo` : 'Limit removed', { kind: 'success' }); onDone(); }} style={{ marginTop: 12 }}>
        <Text style={s.editorCta}>Save limit</Text>
      </MetalButton>
    </View>
  );
}

function DetailsPanel({ card }: { card: PointerCard }) {
  return (
    <View style={s.editor}>
      <DetailRow label="Card number" value={`4242 4212 8890 ${card.last4}`} />
      <DetailRow label="Expiry" value="09 / 29" border />
      <DetailRow label="CVV" value="•••" border />
      <Text style={s.detailsHint}>Reveal & copy full details in the real build (issuer-secured).</Text>
    </View>
  );
}

function DetailRow({ label, value, border }: { label: string; value: string; border?: boolean }) {
  return (
    <View style={[s.detailRow, border && s.detailRowBorder]}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}

/* ── Create ───────────────────────────────────────────── */

function CreateCard({ gradient, onBack, onCreated }: { gradient: [string, string]; onBack: () => void; onCreated: (id: string) => void }) {
  const [cat, setCat] = useState<CardCategory>('travel');
  const [name, setName] = useState('');
  const meta = CATEGORY_META[cat];
  const preview = useMemo<PointerCard>(() => ({ id: 'preview', last4: '0000', nickname: name.trim() || meta.defaultName, category: cat, frozen: false, favourite: false, monthlyLimit: 0, spentThisMonth: 0, spends: [] }), [cat, name, meta.defaultName]);

  return (
    <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={s.mHead}>
        <PressScale to={0.9} onPress={onBack} style={s.backBtn}><Ionicons name="chevron-back" size={22} color={colors.fgSecondary} /></PressScale>
        <Text style={s.mTitle}>New card</Text>
        <View style={s.backBtn} />
      </View>

      <CardFace card={preview} gradient={gradient} ink={faceInk(gradient)} />

      <Text style={s.section}>Purpose</Text>
      <View style={s.catGrid}>
        {CARD_CATEGORIES.map((c) => {
          const m = CATEGORY_META[c];
          const on = c === cat;
          return (
            <PressScale key={c} to={0.95} onPress={() => setCat(c)} style={[s.catChip, on && s.catChipOn]}>
              <Ionicons name={m.icon as any} size={16} color={on ? '#0A0C10' : '#D2D8DE'} />
              <Text style={[s.catText, on && s.catTextOn]}>{m.label}</Text>
            </PressScale>
          );
        })}
      </View>

      <Text style={s.section}>Nickname</Text>
      <TextInput value={name} onChangeText={setName} style={s.editorInput} placeholder={meta.defaultName} placeholderTextColor={colors.fgFaint} maxLength={22} />

      <MetalButton onPress={() => { const c = createCard(cat, name); showToast('Card created', { sub: c.nickname, kind: 'success' }); onCreated(c.id); }} style={{ marginTop: 20 }}>
        <Ionicons name="add" size={18} color="#0A0C10" />
        <Text style={s.editorCta}>Create card</Text>
      </MetalButton>
    </ScrollView>
  );
}

/* ── helpers ──────────────────────────────────────────── */

function lum(hex: string): number {
  const h = hex.replace('#', '');
  return 0.299 * parseInt(h.slice(0, 2), 16) + 0.587 * parseInt(h.slice(2, 4), 16) + 0.114 * parseInt(h.slice(4, 6), 16);
}
function faceInk(gradient: [string, string]): string {
  return (lum(gradient[0]) + lum(gradient[1])) / 2 > 150 ? '#0A0C10' : '#F4F6F8';
}

const s = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 16 },
  title: { color: colors.fg, fontSize: 24, fontWeight: '800' },
  section: { color: colors.fgSecondary, fontSize: 13, fontWeight: '700', letterSpacing: 0.3, marginTop: 22, marginBottom: 8 },
  foot: { color: colors.fgFaint, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 20 },

  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  newBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#C7CCD1' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 10 },
  rowName: { color: colors.fg, fontSize: 15.5, fontWeight: '700' },
  rowSub: { color: colors.fgMuted, fontSize: 12.5, marginTop: 2 },
  thumb: { width: 52, height: 34, borderRadius: 7, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  thumbEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.5)' },

  createRow: { flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(199,204,209,0.22)', borderStyle: 'dashed', padding: 13, marginTop: 14 },
  createIcon: { width: 52, height: 34, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(199,204,209,0.10)' },
  createTitle: { color: colors.fg, fontSize: 15, fontWeight: '700' },
  createSub: { color: colors.fgMuted, fontSize: 12.5, marginTop: 1 },

  // manage
  mHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  mTitle: { color: colors.fg, fontSize: 17, fontWeight: '800', flex: 1, textAlign: 'center' },

  face: { height: 188, borderRadius: radius.lg, overflow: 'hidden', padding: 18, justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', shadowColor: '#C7CCD1', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  faceEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(255,255,255,0.5)' },
  faceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faceBrand: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  faceBrandText: { fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  faceNick: { fontSize: 13, fontWeight: '700', maxWidth: 130 },
  faceNumRow: { flexDirection: 'row', alignItems: 'center' },
  faceNum: { fontSize: 17, fontWeight: '600', letterSpacing: 2 },
  faceBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  faceMode: { fontSize: 12.5, fontWeight: '700', letterSpacing: 1 },
  frozenBadge: { position: 'absolute', top: 14, right: 14, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(20,40,60,0.55)', alignItems: 'center', justifyContent: 'center' },

  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, paddingHorizontal: 4 },
  action: { alignItems: 'center', gap: 7, width: 62 },
  actionBtn: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowColor: '#C7CCD1', shadowOpacity: 0.28, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  actionSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%' },
  actionLabel: { color: colors.fgSecondary, fontSize: 11.5, fontWeight: '600' },

  editor: { borderRadius: radius.md, backgroundColor: colors.bgRaised2, padding: 14, marginTop: 16, borderWidth: 1, borderColor: colors.border },
  editorLabel: { color: colors.fgMuted, fontSize: 12.5, fontWeight: '700', marginBottom: 8 },
  editorInput: { backgroundColor: colors.bgRaised, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 13, color: colors.fg, fontSize: 16, borderWidth: 1, borderColor: colors.border },
  editorCta: { color: '#0A0C10', fontSize: 16, fontWeight: '700' },
  limitInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgRaised, borderRadius: radius.md, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border },
  limitDollar: { color: colors.fgMuted, fontSize: 20, fontWeight: '700' },
  limitInput: { flex: 1, color: colors.fg, fontSize: 22, fontWeight: '700', paddingVertical: 12, paddingLeft: 6 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  preset: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  presetText: { color: colors.fgSecondary, fontSize: 13, fontWeight: '700' },

  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  detailRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  detailLabel: { color: colors.fgMuted, fontSize: 14 },
  detailValue: { color: colors.fg, fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  detailsHint: { color: colors.fgFaint, fontSize: 11.5, lineHeight: 16, marginTop: 8 },

  tracker: { borderRadius: radius.lg, backgroundColor: colors.bgRaised, padding: 16, marginTop: 18, borderWidth: 1, borderColor: colors.border },
  trackerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trackerLabel: { color: colors.fgMuted, fontSize: 13 },
  trackerLeft: { color: colors.bull, fontSize: 14, fontWeight: '800' },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.bgRaised2, marginTop: 12, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  tiles: { flexDirection: 'row', gap: 10, marginTop: 16 },
  tile: { flex: 1, borderRadius: radius.md, backgroundColor: colors.bgRaised2, padding: 13 },
  tileLabel: { color: colors.fgMuted, fontSize: 12 },
  tileVal: { color: colors.fg, fontSize: 20, fontWeight: '800', marginTop: 4, letterSpacing: -0.4 },
  tileSub: { color: colors.fgFaint, fontSize: 11.5, marginTop: 2 },

  txn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  txnIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.bgRaised2, alignItems: 'center', justifyContent: 'center' },
  txnMerchant: { color: colors.fg, fontSize: 15, fontWeight: '600' },
  txnMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  txnWhen: { color: colors.fgMuted, fontSize: 12.5 },
  txnCat: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.bullSoft, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  txnCatText: { color: colors.bull, fontSize: 10, fontWeight: '700' },
  txnAmt: { color: colors.fg, fontSize: 15, fontWeight: '700' },
  empty: { color: colors.fgMuted, fontSize: 14, paddingVertical: 16 },

  delete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, marginTop: 20, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,90,90,0.25)' },
  deleteText: { color: colors.bear, fontSize: 15, fontWeight: '700' },

  // create
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  catChipOn: { backgroundColor: '#C7CCD1', borderColor: '#C7CCD1' },
  catText: { color: colors.fgSecondary, fontSize: 13.5, fontWeight: '600' },
  catTextOn: { color: '#0A0C10', fontWeight: '700' },
});
