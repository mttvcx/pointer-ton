'use client';

import { useMemo, useState } from 'react';
import { Copy, FolderOpen, GripVertical } from 'lucide-react';
import { GlassModal } from '@/components/ui/GlassModal';
import { modalBtnPrimaryClass } from '@/lib/ui/modalChrome';
import { SolGlyph } from '@/components/chains/SolGlyph';
import { DEMO_SQUADS } from '@/lib/squads/demo';
import { cn } from '@/lib/utils/cn';
import { useSquadsChatUiStore } from '@/store/squadsChatUi';
import { toast } from 'sonner';

type UserPrefs = {
  squadAlerts: boolean;
  tradeAlerts: boolean;
  mentionAlerts: boolean;
  lobbyToast: boolean;
  borderFollowing: boolean;
  borderFollowed: boolean;
  linksClickable: boolean;
  linkWarnings: boolean;
  shareWallets: boolean;
  toastDurationSec: number;
};

const DEFAULT_USER_PREFS: UserPrefs = {
  squadAlerts: true,
  tradeAlerts: true,
  mentionAlerts: true,
  lobbyToast: true,
  borderFollowing: true,
  borderFollowed: true,
  linksClickable: false,
  linkWarnings: true,
  shareWallets: true,
  toastDurationSec: 10,
};

const DEMO_WALLETS = [
  {
    id: 'main',
    label: 'Pointer Main',
    address: 'fsw11Xk2…VAPK',
    fullAddress: 'fsw11Xk2mN8pQrT4vL9wH3jK6yB1cD5eF7gH8iJ0kL2mN4oP6qR8sT0uVAPK',
    sol: 0,
  },
] as const;

export function SquadsLobbySettingsModal({
  open,
  onClose,
  squadName,
}: {
  open: boolean;
  onClose: () => void;
  squadName: string;
}) {
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_USER_PREFS);
  const [dragIx, setDragIx] = useState<number | null>(null);
  const squadOrder = useSquadsChatUiStore((s) => s.squadOrder);
  const moveSquad = useSquadsChatUiStore((s) => s.moveSquad);
  const resetSquadOrder = useSquadsChatUiStore((s) => s.resetSquadOrder);

  const orderedSquads = useMemo(() => {
    const bySlug = new Map(DEMO_SQUADS.map((s) => [s.slug, s]));
    return squadOrder.map((slug) => bySlug.get(slug)).filter(Boolean) as typeof DEMO_SQUADS;
  }, [squadOrder]);

  const setPref = <K extends keyof UserPrefs>(key: K, value: UserPrefs[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
  };

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title="Squad settings"
      maxWidthClass="max-w-[440px]"
      zClass="z-[650]"
      footer={
        <button
          type="button"
          onClick={onClose}
          className={modalBtnPrimaryClass}
        >
          Done
        </button>
      }
    >
      <p className="text-[12px] text-fg-muted">
        Settings for <span className="text-fg-secondary">{squadName}</span>
      </p>

      <div className="mt-4 max-h-[min(60vh,480px)] space-y-5 overflow-y-auto overscroll-contain pr-1">
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
              Squad tabs
            </h3>
            <button
              type="button"
              onClick={resetSquadOrder}
              className="text-[11px] font-medium text-fg-muted transition hover:text-fg-secondary"
            >
              Reset order
            </button>
          </div>
          <p className="mb-2 text-[11px] leading-snug text-fg-muted">
            Drag to reorder which squads show first in the chat strip — same idea as dock tracker order.
          </p>
          <ul className="divide-y divide-border-subtle rounded-md border border-border-subtle bg-bg-base/40">
            {orderedSquads.map((s, ix) => (
              <li
                key={s.slug}
                draggable
                onDragStart={() => setDragIx(ix)}
                onDragOver={(ev) => ev.preventDefault()}
                onDrop={() => {
                  if (dragIx === null || dragIx === ix) return;
                  moveSquad(dragIx, ix);
                  setDragIx(null);
                }}
                onDragEnd={() => setDragIx(null)}
                className="flex cursor-grab items-center gap-2 px-3 py-2.5 active:cursor-grabbing"
              >
                <GripVertical className="h-4 w-4 shrink-0 text-fg-muted/70" strokeWidth={2} aria-hidden />
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-primary/15 text-[10px] font-bold text-accent-primary">
                  {s.monogram}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-fg-primary">{s.name}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
            Alerts
          </h3>
          <div className="divide-y divide-border-subtle rounded-md border border-border-subtle bg-bg-base/40">
            <ToggleRow
              label="Squad alerts"
              hint="Votes, signals, and room updates"
              on={prefs.squadAlerts}
              onChange={(v) => setPref('squadAlerts', v)}
            />
            <ToggleRow
              label="Trade alerts"
              hint="When a member shares a trade"
              on={prefs.tradeAlerts}
              onChange={(v) => setPref('tradeAlerts', v)}
            />
            <ToggleRow
              label="Mention alerts"
              hint="@you in squad chat"
              on={prefs.mentionAlerts}
              onChange={(v) => setPref('mentionAlerts', v)}
            />
            <ToggleRow
              label="Toast notifications"
              on={prefs.lobbyToast}
              onChange={(v) => setPref('lobbyToast', v)}
            />
            {prefs.lobbyToast ? (
              <div className="flex items-center justify-between gap-3 px-3 py-3">
                <span className="text-[13px] text-fg-primary">Toast duration</span>
                <div className="flex min-w-[9rem] flex-col items-end gap-1">
                  <span className="text-[12px] tabular-nums text-fg-muted">
                    {prefs.toastDurationSec}s
                  </span>
                  <input
                    type="range"
                    min={5}
                    max={20}
                    step={1}
                    value={prefs.toastDurationSec}
                    onChange={(e) => setPref('toastDurationSec', Number(e.target.value))}
                    className="h-1.5 w-full accent-accent-primary"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
            Chat & profile
          </h3>
          <div className="divide-y divide-border-subtle rounded-md border border-border-subtle bg-bg-base/40">
            <ToggleRow
              label="Highlight when you follow"
              on={prefs.borderFollowing}
              onChange={(v) => setPref('borderFollowing', v)}
            />
            <ToggleRow
              label="Highlight when followed"
              on={prefs.borderFollowed}
              onChange={(v) => setPref('borderFollowed', v)}
            />
            <ToggleRow
              label="Clickable links"
              on={prefs.linksClickable}
              onChange={(v) => setPref('linksClickable', v)}
            />
            <ToggleRow
              label="Link warnings"
              on={prefs.linkWarnings}
              onChange={(v) => setPref('linkWarnings', v)}
            />
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
            Shared wallets
          </h3>
          <ToggleRow
            label="Share wallet balances with squad"
            on={prefs.shareWallets}
            onChange={(v) => setPref('shareWallets', v)}
            className="rounded-md border border-border-subtle bg-bg-base/40"
          />

          {prefs.shareWallets ? (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-3 rounded-md border border-border-subtle bg-bg-base/40 px-3 py-2">
                <FolderOpen className="h-4 w-4 shrink-0 text-fg-muted" strokeWidth={2} />
                <span className="text-[13px] tabular-nums text-fg-primary">0</span>
                <SolGlyph size={16} />
              </div>

              <ul className="divide-y divide-border-subtle rounded-md border border-border-subtle">
                {DEMO_WALLETS.map((w) => (
                  <li key={w.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-accent-ethos">{w.label}</p>
                      <button
                        type="button"
                        className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-fg-muted transition hover:text-fg-secondary"
                        onClick={() => {
                          void navigator.clipboard.writeText(w.fullAddress);
                          toast.success('Address copied');
                        }}
                      >
                        {w.address}
                        <Copy className="h-3 w-3" strokeWidth={2} aria-hidden />
                      </button>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 tabular-nums text-[12px] text-fg-secondary">
                      {w.sol}
                      <SolGlyph size={14} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </GlassModal>
  );
}

function ToggleRow({
  label,
  hint,
  on,
  onChange,
  className,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (v: boolean) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 px-3 py-3', className)}>
      <div className="min-w-0">
        <span className="text-[13px] text-fg-primary">{label}</span>
        {hint ? <p className="mt-0.5 text-[11px] text-fg-muted">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition',
          on ? 'bg-accent-primary' : 'bg-fg-primary/12',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition',
            on ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  );
}
