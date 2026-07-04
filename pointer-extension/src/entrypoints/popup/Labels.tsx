import { useCallback, useEffect, useState } from 'react';
import {
  addGroup,
  addProfile,
  addWallet,
  exportAll,
  getGroups,
  getProfiles,
  getWallets,
  importWallets,
  parseImport,
  removeGroup,
  removeProfile,
  removeWallet,
  short,
  type Chain as ChainTag,
  type LabelGroup,
  type ProfileLabel,
  type WalletLabel,
} from '@/lib/labels';
import { EmptyState, GlassButton, Ic, IconButton, Pill, Segmented, useOutside } from './components';

type SubTab = 'profiles' | 'wallets' | 'groups';
type View = 'list' | 'add-wallet' | 'add-profile' | 'add-group' | 'import';

const EXPLORE = ['Twitter / X', 'Axiom', 'Padre', 'GMGN', 'DEX', 'Solscan', 'Pump.fun'];

export function Labels() {
  const [tab, setTab] = useState<SubTab>('wallets');
  const [view, setView] = useState<View>('list');
  const [wallets, setWallets] = useState<WalletLabel[]>([]);
  const [profiles, setProfiles] = useState<ProfileLabel[]>([]);
  const [groups, setGroups] = useState<LabelGroup[]>([]);
  const [menu, setMenu] = useState(false);
  const menuRef = useOutside(() => setMenu(false));

  const reload = useCallback(async () => {
    const [w, p, g] = await Promise.all([getWallets(), getProfiles(), getGroups()]);
    setWallets(w);
    setProfiles(p);
    setGroups(g);
  }, []);
  useEffect(() => void reload(), [reload]);

  const done = async () => {
    await reload();
    setView('list');
  };

  if (view === 'add-wallet') return <AddWallet groups={groups} onDone={done} onCancel={() => setView('list')} />;
  if (view === 'add-profile') return <AddProfile onDone={done} onCancel={() => setView('list')} />;
  if (view === 'add-group') return <AddGroup onDone={done} onCancel={() => setView('list')} />;
  if (view === 'import') return <ImportView onDone={done} onCancel={() => setView('list')} />;

  const addOptions = [
    { label: 'Add wallet label', icon: <Ic.Tag size={15} />, run: () => setView('add-wallet') },
    { label: 'Add profile label', icon: <Ic.User size={15} />, run: () => setView('add-profile') },
    { label: 'Add group', icon: <Ic.Plus size={15} />, run: () => setView('add-group') },
    { label: 'Import labels', icon: <Ic.Import size={15} />, run: () => setView('import') },
    {
      label: 'Export labels',
      icon: <Ic.Export size={15} />,
      run: async () => {
        const bundle = await exportAll();
        const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }));
        await chrome.downloads.download({ url, filename: 'pointer-labels.json', saveAs: true }).catch(() => window.open(url, '_blank'));
      },
    },
  ];

  const list = tab === 'wallets' ? wallets : tab === 'profiles' ? profiles : groups;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Segmented<SubTab> sm value={tab} onChange={setTab} options={[{ id: 'profiles', label: 'Profiles' }, { id: 'wallets', label: 'Wallets' }, { id: 'groups', label: 'Groups' }]} />
        <div style={{ position: 'relative', marginLeft: 'auto' }} ref={menuRef}>
          <GlassButton variant="accent" sm onClick={() => setMenu((m) => !m)}>
            <Ic.Plus size={14} /> Add
          </GlassButton>
          {menu && (
            <div className="popover" style={{ top: '100%', right: 0, marginTop: 7, minWidth: 188, padding: 5 }}>
              {addOptions.map((o) => (
                <button
                  key={o.label}
                  className="menu-item"
                  onClick={() => {
                    setMenu(false);
                    void o.run();
                  }}
                >
                  <span style={{ color: 'var(--fg-muted)', display: 'grid', placeItems: 'center' }}>{o.icon}</span>
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* explore universal labels */}
      <div>
        <div className="section-label" style={{ marginBottom: 8 }}>Explore universal labels</div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
          {EXPLORE.map((e) => (
            <span key={e} className="pill pill--chip" style={{ flexShrink: 0, height: 28 }}>
              {e}
            </span>
          ))}
        </div>
      </div>

      {/* list / empty */}
      {list.length > 0 && <div className="section-label">Recent labels</div>}
      {tab === 'wallets' &&
        (wallets.length ? (
          <Group>
            {wallets.map((w) => (
              <Row key={w.id} title={w.label || short(w.address)} sub={`${short(w.address)} · ${w.chain.toUpperCase()}${w.group ? ` · ${groups.find((g) => g.id === w.group)?.name ?? ''}` : ''}`} onDelete={async () => { await removeWallet(w.id); void reload(); }} />
            ))}
          </Group>
        ) : (
          <EmptyState icon={<Ic.Tag size={22} />} title="No wallet labels yet" body="Add a wallet here, or hover any wallet as you browse to tag it — labels stay on your device and sync to Pointer." action={<GlassButton variant="accent" block onClick={() => setView('add-wallet')}><Ic.Plus size={15} /> Add wallet label</GlassButton>} />
        ))}

      {tab === 'profiles' &&
        (profiles.length ? (
          <Group>
            {profiles.map((p) => (
              <Row key={p.id} title={`@${p.handle}`} sub={p.note || 'No note'} onDelete={async () => { await removeProfile(p.id); void reload(); }} />
            ))}
          </Group>
        ) : (
          <EmptyState icon={<Ic.User size={22} />} title="No profile labels yet" body="Tag an X profile here, or hover one on X to add a private note that follows them everywhere." action={<GlassButton variant="accent" block onClick={() => setView('add-profile')}><Ic.Plus size={15} /> Add profile label</GlassButton>} />
        ))}

      {tab === 'groups' &&
        (groups.length ? (
          <Group>
            {groups.map((g) => (
              <Row key={g.id} title={g.name} sub={`${wallets.filter((w) => w.group === g.id).length} wallets`} onDelete={async () => { await removeGroup(g.id); void reload(); }} />
            ))}
          </Group>
        ) : (
          <EmptyState icon={<Ic.Tag size={22} />} title="No groups yet" body="Bucket wallets into groups like “Smart money” or “Insiders” and color them on-page." action={<GlassButton variant="glass" block onClick={() => setView('add-group')}><Ic.Plus size={15} /> Create group</GlassButton>} />
        ))}
    </>
  );
}

/* ───────────────────────── list + row ───────────────────────── */
function Group({ children }: { children: React.ReactNode }) {
  return <div className="glass row-group">{children}</div>;
}
function Row({ title, sub, onDelete }: { title: string; sub: string; onDelete: () => void }) {
  return (
    <div className="row" style={{ cursor: 'default' }}>
      <div className="row__body">
        <div className="row__title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        <div className="row__sub">{sub}</div>
      </div>
      <IconButton label="Delete" onClick={onDelete}>
        <Ic.Trash size={15} />
      </IconButton>
    </div>
  );
}

/* ───────────────────────── form shell ───────────────────────── */
function Form({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <IconButton label="Back" onClick={onBack}>
          <Ic.Back size={18} />
        </IconButton>
        <span style={{ fontWeight: 650, fontSize: 13.5 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-secondary)', display: 'block', marginBottom: 6 }}>{children}</label>;
}

function AddWallet({ groups, onDone, onCancel }: { groups: LabelGroup[]; onDone: () => void; onCancel: () => void }) {
  const [address, setAddress] = useState('');
  const [chain, setChain] = useState<ChainTag>('sol');
  const [label, setLabel] = useState('');
  const [group, setGroup] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = address.trim().length >= 20;
  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    let groupId: string | undefined;
    const g = group.trim();
    if (g) {
      const m = groups.find((x) => x.name.toLowerCase() === g.toLowerCase());
      groupId = m ? m.id : (await addGroup(g)).id;
    }
    await addWallet({ address: address.trim(), chain, label: label.trim(), group: groupId });
    onDone();
  };
  return (
    <Form title="Add wallet label" onBack={onCancel}>
      <div>
        <Label>Wallet address</Label>
        <input className="input" placeholder="Paste the wallet address" value={address} onChange={(e) => setAddress(e.target.value)} autoFocus />
      </div>
      <Segmented<ChainTag> value={chain} onChange={setChain} options={[{ id: 'sol', label: 'SOL' }, { id: 'bnb', label: 'BNB' }]} />
      <div>
        <Label>Label</Label>
        <input className="input" maxLength={33} placeholder="A name for easy tracking" value={label} onChange={(e) => setLabel(e.target.value)} />
        <div className="meta" style={{ textAlign: 'right', marginTop: 5 }}>{label.length}/33</div>
      </div>
      <div>
        <Label>Add to group</Label>
        <input className="input" placeholder="Search or create a group" value={group} onChange={(e) => setGroup(e.target.value)} list="pt-groups" />
        <datalist id="pt-groups">{groups.map((g) => <option key={g.id} value={g.name} />)}</datalist>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <GlassButton variant="ghost" block onClick={onCancel}>Cancel</GlassButton>
        <GlassButton variant="accent" block disabled={!valid || busy} onClick={save}>Save label</GlassButton>
      </div>
    </Form>
  );
}

function AddProfile({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [handle, setHandle] = useState('');
  const [note, setNote] = useState('');
  const valid = handle.replace(/^@/, '').trim().length > 0;
  return (
    <Form title="Add profile label" onBack={onCancel}>
      <div>
        <Label>X / Twitter handle</Label>
        <input className="input" placeholder="@handle" value={handle} onChange={(e) => setHandle(e.target.value)} autoFocus />
      </div>
      <div>
        <Label>Note</Label>
        <input className="input" maxLength={80} placeholder="Private note (e.g. “known insider”)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <GlassButton variant="ghost" block onClick={onCancel}>Cancel</GlassButton>
        <GlassButton variant="accent" block disabled={!valid} onClick={async () => { await addProfile({ handle: handle.trim(), note: note.trim() }); onDone(); }}>Save label</GlassButton>
      </div>
    </Form>
  );
}

function AddGroup({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const valid = name.trim().length > 0;
  return (
    <Form title="Add group" onBack={onCancel}>
      <div>
        <Label>Group name</Label>
        <input className="input" placeholder="e.g. Smart money" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <GlassButton variant="ghost" block onClick={onCancel}>Cancel</GlassButton>
        <GlassButton variant="accent" block disabled={!valid} onClick={async () => { await addGroup(name.trim()); onDone(); }}>Create group</GlassButton>
      </div>
    </Form>
  );
}

function ImportView({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const run = async () => {
    const { wallets } = parseImport(text);
    if (!wallets.length) {
      setResult('Nothing recognized — paste exported JSON, or “address,label” lines.');
      return;
    }
    const n = await importWallets(wallets);
    setResult(`Imported ${n} wallet${n === 1 ? '' : 's'}.`);
    setTimeout(onDone, 700);
  };
  return (
    <Form title="Import labels" onBack={onCancel}>
      <div className="glass" style={{ display: 'flex', gap: 8, padding: '10px 12px', fontSize: 11.5, color: 'var(--fg-secondary)', lineHeight: 1.45, alignItems: 'flex-start' }}>
        <span style={{ color: 'var(--pt-accent)', flexShrink: 0, display: 'grid', placeItems: 'center', marginTop: 1 }}><Ic.Lock size={13} /></span>
        <span>Imported labels stay private to you and live on your device — never shared with other users.</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {['GMGN', 'Solscan', 'Axiom', 'Photon'].map((s) => (
          <Pill key={s} chip style={{ height: 26 }}>{s}</Pill>
        ))}
      </div>
      <textarea className="input" style={{ minHeight: 116, resize: 'vertical', lineHeight: 1.4 }} placeholder={'So1abc...,Whale\nBn4def...,Insider'} value={text} onChange={(e) => setText(e.target.value)} />
      {result && <p className="meta" style={{ margin: 0, color: 'var(--fg-secondary)' }}>{result}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <GlassButton variant="ghost" block onClick={onCancel}>Cancel</GlassButton>
        <GlassButton variant="accent" block disabled={!text.trim()} onClick={run}>Import</GlassButton>
      </div>
    </Form>
  );
}
