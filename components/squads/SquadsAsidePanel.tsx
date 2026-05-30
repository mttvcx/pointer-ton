'use client';

import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  Activity,
  Bell,
  ChevronUp,
  PanelRight,
  Settings,
  Smile,
  Users,
  X,
} from 'lucide-react';
import { DEMO_ROOM_ACTIVITIES, DEMO_SQUADS } from '@/lib/squads/demo';
import { closeSquadsRail } from '@/lib/squads/openSquadsOnPulse';
import { SquadSwitcherStrip } from '@/components/squads/SquadSwitcherStrip';
import { SquadsLobbyEmojiPicker } from '@/components/squads/SquadsLobbyEmojiPicker';
import { SquadsLobbyFriendsPanel } from '@/components/squads/SquadsLobbyFriendsPanel';
import { SquadsLobbyProfileModal } from '@/components/squads/SquadsLobbyProfileModal';
import { SquadsLobbySettingsModal } from '@/components/squads/SquadsLobbySettingsModal';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSquadsChatUiStore } from '@/store/squadsChatUi';
import { cn } from '@/lib/utils/cn';

const LOBBY_HANDLE = 'pointer_user';

function GripDots({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'pointer-events-none grid shrink-0 grid-cols-2 gap-[3px] text-fg-muted opacity-20',
        className,
      )}
      aria-hidden
    >
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className="h-[3px] w-[3px] rounded-full bg-current" />
      ))}
    </div>
  );
}

function headerDragAllowed(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return true;
  return !target.closest('button, a, input, textarea, [data-squads-no-drag]');
}

function FeedIconToggle({
  label,
  icon: Icon,
  on,
  onChange,
}: {
  label: string;
  icon: typeof Bell;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      title={`${label} ${on ? 'on' : 'off'}`}
      aria-label={`${label} ${on ? 'on' : 'off'}`}
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={cn(
        'btn-press flex h-8 w-8 items-center justify-center rounded-lg transition',
        on
          ? 'bg-accent-primary/15 text-accent-primary'
          : 'text-fg-muted hover:bg-bg-hover hover:text-fg-secondary',
      )}
    >
      <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} aria-hidden />
    </button>
  );
}

function SystemLine({ ago, text }: { ago: string; text: string }) {
  return (
    <p className="px-2 py-0.5 text-center text-[11px] leading-snug text-fg-muted">
      <span className="tabular-nums">{ago}</span> · {text}
    </p>
  );
}

export function SquadsAsidePanel({
  dock = 'right',
  embedded = false,
  draggable = false,
  floating = false,
  onDragHandlePointerDown,
  onClose,
  onDockToRail,
}: {
  dock?: 'left' | 'right';
  embedded?: boolean;
  draggable?: boolean;
  floating?: boolean;
  onDragHandlePointerDown?: (e: ReactPointerEvent<HTMLElement>) => void;
  onClose?: () => void;
  onDockToRail?: () => void;
}) {
  const squadOrder = useSquadsChatUiStore((s) => s.squadOrder);
  const showAlerts = useSquadsChatUiStore((s) => s.showAlertsFeed);
  const showActivity = useSquadsChatUiStore((s) => s.showActivityFeed);
  const setShowAlerts = useSquadsChatUiStore((s) => s.setShowAlertsFeed);
  const setShowActivity = useSquadsChatUiStore((s) => s.setShowActivityFeed);

  const orderedSquads = useMemo(() => {
    const bySlug = new Map(DEMO_SQUADS.map((s) => [s.slug, s]));
    return squadOrder.map((slug) => bySlug.get(slug)).filter(Boolean) as typeof DEMO_SQUADS;
  }, [squadOrder]);

  const [activeSlug, setActiveSlug] = useState(orderedSquads[0]?.slug ?? '');

  useEffect(() => {
    if (!orderedSquads.some((s) => s.slug === activeSlug)) {
      setActiveSlug(orderedSquads[0]?.slug ?? '');
    }
  }, [activeSlug, orderedSquads]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<{ id: string; text: string; at: string }[]>([]);

  const activeSquad = useMemo(
    () => orderedSquads.find((s) => s.slug === activeSlug) ?? orderedSquads[0],
    [activeSlug, orderedSquads],
  );

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    setMessages((m) => [...m, { id: `local-${Date.now()}`, text, at: 'now' }]);
    setDraft('');
    setEmojiOpen(false);
  }

  function handleClose() {
    if (floating && onClose) {
      onClose();
      return;
    }
    closeSquadsRail();
  }

  return (
    <section
      className={cn(
        'relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg-raised',
        embedded && !floating ? 'rounded-none border-0' : '',
      )}
      data-dock={dock}
    >
      <header
        className={cn(
          'sticky top-0 z-[2] shrink-0 border-b border-border-subtle bg-bg-hover/95 backdrop-blur-sm',
          draggable && 'cursor-grab active:cursor-grabbing',
        )}
        onPointerDown={(e) => {
          if (!draggable || e.button !== 0 || !headerDragAllowed(e.target)) return;
          onDragHandlePointerDown?.(e);
        }}
      >
        <div className="flex min-w-0 items-center justify-between gap-2 px-3 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 select-none">
            {draggable ? <GripDots className="hidden sm:grid" /> : null}
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-primary" aria-hidden />
            <h2 className="truncate text-[13px] font-medium text-fg-primary">Squads</h2>
          </div>

          <div className="flex shrink-0 items-center gap-0.5" data-squads-no-drag>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setFriendsOpen(true)}
                  className="btn-press flex h-7 w-7 items-center justify-center rounded-lg text-fg-muted transition hover:bg-bg-hover hover:text-fg-primary"
                >
                  <Users className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Members</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setProfileOpen(true)}
                  className="btn-press flex h-7 w-7 items-center justify-center rounded-full bg-accent-primary/15 text-[10px] font-bold text-accent-primary"
                >
                  {LOBBY_HANDLE.slice(0, 2).toUpperCase()}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Profile</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="btn-press flex h-7 w-7 items-center justify-center rounded-lg text-fg-muted transition hover:bg-bg-hover hover:text-fg-primary"
                >
                  <Settings className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Settings</TooltipContent>
            </Tooltip>

            {floating && onDockToRail ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onDockToRail}
                    className="btn-press flex h-7 w-7 items-center justify-center rounded-lg text-fg-muted transition hover:bg-bg-hover hover:text-fg-primary"
                  >
                    <PanelRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Dock to Pulse</TooltipContent>
              </Tooltip>
            ) : null}

            <button
              type="button"
              title="Hide squads"
              aria-label="Hide squads panel"
              onClick={handleClose}
              className="btn-press flex h-7 w-7 items-center justify-center rounded-lg text-fg-muted transition hover:bg-bg-hover hover:text-fg-primary"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <SquadSwitcherStrip
        squads={orderedSquads}
        activeSlug={activeSlug}
        onSelect={setActiveSlug}
        onBrowse={() => setFriendsOpen(true)}
        trailing={
          <>
            <FeedIconToggle label="Alerts" icon={Bell} on={showAlerts} onChange={setShowAlerts} />
            <FeedIconToggle label="Activity" icon={Activity} on={showActivity} onChange={setShowActivity} />
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 py-3">
        {showAlerts
          ? DEMO_ROOM_ACTIVITIES.slice(0, 3).map((a) => (
              <SystemLine key={`alert-${a.id}`} ago={a.ago} text={a.text} />
            ))
          : null}
        {showActivity
          ? DEMO_ROOM_ACTIVITIES.slice(3, 6).map((a) => (
              <SystemLine key={`act-${a.id}`} ago={a.ago} text={a.text} />
            ))
          : null}

        {messages.length === 0 && !showAlerts && !showActivity ? (
          <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
            <p className="text-[13px] text-fg-muted">No messages yet</p>
            <p className="mt-1 text-[11px] text-fg-muted/80">
              Say hi to {activeSquad?.name ?? 'the squad'}
            </p>
          </div>
        ) : (
          <ul className="mt-auto space-y-2.5">
            {messages.map((msg) => (
              <li key={msg.id} className="flex flex-col items-end">
                <div className="max-w-[88%] rounded-2xl rounded-br-md bg-accent-primary/14 px-3 py-2 text-[13px] leading-snug text-fg-primary ring-1 ring-accent-primary/10">
                  {msg.text}
                </div>
                <span className="mt-0.5 px-1 text-[10px] tabular-nums text-fg-muted">{msg.at}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative shrink-0 px-3 pb-3 pt-1">
        <SquadsLobbyEmojiPicker
          open={emojiOpen}
          onClose={() => setEmojiOpen(false)}
          onPick={(e) => setDraft((d) => d + e)}
        />
        <div className="flex items-center gap-2 rounded-2xl border border-border-subtle bg-bg-hover/90 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Send a message…"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-fg-primary placeholder:text-fg-muted focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') sendMessage();
            }}
          />
          <button
            type="button"
            title="Emoji"
            aria-label="Emoji"
            onClick={() => setEmojiOpen((o) => !o)}
            className={cn(
              'shrink-0 rounded-lg p-1 transition',
              emojiOpen ? 'text-accent-primary' : 'text-fg-muted hover:text-fg-secondary',
            )}
          >
            <Smile className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
          </button>
          <button
            type="button"
            title="Send"
            aria-label="Send message"
            onClick={sendMessage}
            disabled={!draft.trim()}
            className="btn-press flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-primary text-fg-inverse transition hover:brightness-110 disabled:opacity-35"
          >
            <ChevronUp className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </div>

      {friendsOpen ? (
        <SquadsLobbyFriendsPanel
          lobbyTitle={activeSquad?.name ?? 'Squads'}
          memberCap={10}
          onClose={() => setFriendsOpen(false)}
        />
      ) : null}

      <SquadsLobbyProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        handle={LOBBY_HANDLE}
      />
      <SquadsLobbySettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        squadName={activeSquad?.name ?? 'Squads'}
      />
    </section>
  );
}
