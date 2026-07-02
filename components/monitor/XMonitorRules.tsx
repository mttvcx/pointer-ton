'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Crosshair,
  ImageIcon,
  Loader2,
  MessageCircle,
  Plus,
  Rocket,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import {
  AutomationRuleBuilder,
  automationDraftToBody,
  defaultAutomationDraft,
  type AutomationRuleDraft,
} from '@/components/alerts/AutomationRuleBuilder';
import {
  actionTypeLabel,
  triggerTypeLabel,
  type AutomationActionType,
  type AutomationTriggerType,
} from '@/lib/alerts/automationRuleModel';
import { cn } from '@/lib/utils/cn';
import { toast } from 'sonner';

type RuleDto = {
  id: string;
  name: string;
  ruleType: string;
  triggerType: AutomationTriggerType | null;
  actionType: AutomationActionType | null;
  isActive: boolean;
  createdAt: string;
};

const TWITTER_TRIGGERS = new Set([
  'keyword',
  'ca_detected',
  'image_match',
  'interaction',
  'pfp_change',
  'banner_change',
]);

const INPUT =
  'w-full rounded-sm border border-white/[0.08] bg-bg-sunken px-2 py-1.5 text-[11px] text-fg-primary outline-none focus:border-accent-primary/35';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">{children}</span>
  );
}

/** One-tap sniper templates — pre-fill a valid rule draft; user just adds handles. */
type SniperPreset = {
  id: string;
  label: string;
  desc: string;
  icon: typeof Crosshair;
  build: () => AutomationRuleDraft;
};

function makePreset(over: Partial<AutomationRuleDraft>): AutomationRuleDraft {
  const base = defaultAutomationDraft();
  return {
    ...base,
    ...over,
    triggerConfig: over.triggerConfig ?? base.triggerConfig,
    actionConfig: over.actionConfig ?? base.actionConfig,
    activityFilter: over.activityFilter ?? base.activityFilter,
  };
}

const SNIPER_PRESETS: SniperPreset[] = [
  {
    id: 'ca',
    label: 'CA sniper',
    desc: 'Auto-buy any contract a watched account drops',
    icon: Crosshair,
    build: () =>
      makePreset({
        name: 'CA sniper',
        triggerType: 'ca_detected',
        triggerConfig: { handlesRaw: '', tweetImageMintMode: 'smart' },
        actionType: 'buy',
        actionConfig: { buySolPreset: '', slippageBps: null },
        activityFilter: { tweets: true, replies: true, quotes: true, retweets: false },
        cooldownSeconds: 30,
      }),
  },
  {
    id: 'keyword-buy',
    label: 'Keyword buy',
    desc: 'Buy when a watched account posts a phrase',
    icon: Search,
    build: () =>
      makePreset({
        name: 'Keyword buy',
        triggerType: 'keyword',
        triggerConfig: { handlesRaw: '', phrasesRaw: '', phraseMatch: 'substring' },
        actionType: 'buy',
        actionConfig: { buySolPreset: '', slippageBps: null },
        cooldownSeconds: 30,
      }),
  },
  {
    id: 'auto-launch',
    label: 'Auto-launch',
    desc: 'Deploy a token the moment they post',
    icon: Rocket,
    build: () =>
      makePreset({
        name: 'Auto-launch on post',
        triggerType: 'keyword',
        triggerConfig: { handlesRaw: '', phrasesRaw: '', phraseMatch: 'substring' },
        actionType: 'deploy',
        actionConfig: {},
        activityFilter: { tweets: true, replies: false, quotes: false, retweets: false },
        disableAfterSuccess: true,
      }),
  },
  {
    id: 'interaction',
    label: 'Reply / quote',
    desc: 'Alert when they reply to or quote someone',
    icon: MessageCircle,
    build: () =>
      makePreset({
        name: 'Reply / quote watcher',
        triggerType: 'interaction',
        triggerConfig: { handlesRaw: '', kinds: ['reply', 'quote'] },
        actionType: 'notify',
        actionConfig: { openWithTweetMedia: true, tweetImageMintMode: 'smart' },
      }),
  },
  {
    id: 'image',
    label: 'Image snipe',
    desc: 'Buy on a matching image / meme',
    icon: ImageIcon,
    build: () =>
      makePreset({
        name: 'Image match snipe',
        triggerType: 'image_match',
        triggerConfig: {
          handlesRaw: '',
          thresholdPreset: 'normal',
          targetImageHash: '',
          tweetImageMintMode: 'smart',
          openWithTweetMedia: true,
        },
        actionType: 'buy',
        actionConfig: { buySolPreset: '', slippageBps: null },
      }),
  },
  {
    id: 'pfp',
    label: 'PFP change',
    desc: 'Alert when they swap avatar',
    icon: UserRound,
    build: () =>
      makePreset({
        name: 'PFP change alert',
        triggerType: 'pfp_change',
        triggerConfig: { handlesRaw: '' },
        actionType: 'notify',
        actionConfig: { openWithTweetMedia: true, tweetImageMintMode: 'smart' },
      }),
  },
];

export function XMonitorRules() {
  const { authenticated, getAccessToken } = usePointerAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<AutomationRuleDraft>(() => ({
    ...defaultAutomationDraft(),
    name: 'Watch @handle',
  }));
  const [showCreate, setShowCreate] = useState(true);
  // Bumped to force-remount AutomationRuleBuilder (its handle/phrase fields seed
  // once from the draft) whenever a preset is applied or the form resets.
  const [builderKey, setBuilderKey] = useState(0);

  function applyPreset(p: SniperPreset) {
    setDraft(p.build());
    setShowCreate(true);
    setBuilderKey((k) => k + 1);
  }

  const listQuery = useQuery({
    queryKey: ['alert-rules'],
    enabled: authenticated,
    queryFn: async (): Promise<RuleDto[]> => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/alert-rules', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('list_failed');
      const j = (await res.json()) as { rules?: RuleDto[] };
      return Array.isArray(j.rules) ? j.rules : [];
    },
  });

  const twitterRules = useMemo(
    () =>
      (listQuery.data ?? []).filter(
        (r) => r.triggerType && TWITTER_TRIGGERS.has(r.triggerType),
      ),
    [listQuery.data],
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const body = automationDraftToBody(draft);
      const res = await fetch('/api/alert-rules', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? 'create_failed');
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['alert-rules'] });
      setDraft({ ...defaultAutomationDraft(), name: 'Watch @handle' });
      setBuilderKey((k) => k + 1);
      toast.success('Rule saved');
    },
    onError: (e: Error) => {
      console.error('[XMonitorRules] create rule', e);
      toast.error('Couldn’t save rule — please try again');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch(`/api/alert-rules/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('delete_failed');
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['alert-rules'] }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch(`/api/alert-rules/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error('patch_failed');
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['alert-rules'] }),
  });

  if (!authenticated) {
    return (
      <p className="px-3 py-4 text-[11px] text-fg-muted">Sign in to manage X listen rules.</p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(var(--app-bottombar-h)+16px)]">
        {listQuery.isLoading ? (
          <p className="flex items-center gap-2 px-3 py-4 text-[11px] text-fg-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Loading rules…
          </p>
        ) : null}

        {twitterRules.length > 0 ? (
          <ul className="divide-y divide-white/[0.06]">
            {twitterRules.map((rule) => (
              <li
                key={rule.id}
                className="flex items-start justify-between gap-2 px-3 py-2.5 hover:bg-white/[0.02]"
              >
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-fg-primary">{rule.name}</p>
                  <p className="mt-0.5 text-[10px] text-fg-muted">
                    {rule.triggerType ? triggerTypeLabel(rule.triggerType) : '—'} →{' '}
                    {rule.actionType ? actionTypeLabel(rule.actionType) : '—'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      toggleMutation.mutate({ id: rule.id, isActive: !rule.isActive })
                    }
                    className={cn(
                      'rounded-sm border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                      rule.isActive
                        ? 'border-accent-primary/35 bg-accent-primary/12 text-accent-primary'
                        : 'border-white/[0.08] text-fg-muted',
                    )}
                  >
                    {rule.isActive ? 'On' : 'Off'}
                  </button>
                  <button
                    type="button"
                    aria-label="Delete rule"
                    onClick={() => deleteMutation.mutate(rule.id)}
                    className="rounded-sm p-1 text-fg-muted hover:bg-white/[0.06] hover:text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : !listQuery.isLoading ? (
          <p className="px-3 py-4 text-[11px] text-fg-muted">No X rules yet — add one below.</p>
        ) : null}

        <div className="border-t border-white/[0.06] px-3 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
            Quick snipers
          </p>
          <div className="mb-3 grid grid-cols-2 gap-1.5">
            {SNIPER_PRESETS.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p)}
                  title={p.desc}
                  className="btn-press group flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-2 text-left transition-colors hover:border-accent-primary/40 hover:bg-accent-primary/[0.07]"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-white/[0.05] text-fg-muted transition-colors group-hover:bg-accent-primary/20 group-hover:text-accent-primary">
                    <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-semibold text-fg-primary">{p.label}</span>
                    <span className="block truncate text-[9px] leading-tight text-fg-muted">{p.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="flex w-full items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-fg-secondary hover:text-fg-primary"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            {showCreate ? 'Hide new rule' : 'New rule'}
          </button>

          {showCreate ? (
            <div className="mt-3 space-y-3">
              <label className="block space-y-1">
                <FieldLabel>Rule name</FieldLabel>
                <input
                  className={INPUT}
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Elon deploy watcher"
                />
              </label>

              <AutomationRuleBuilder
                key={builderKey}
                draft={draft}
                onChange={(patch) =>
                  setDraft((d) =>
                    typeof patch === 'function' ? patch(d) : { ...d, ...patch },
                  )
                }
                inputCls={INPUT}
                terminal
              />

              <p className="text-[10px] leading-snug text-fg-muted">
                Action <strong className="text-fg-secondary">AI auto-launch</strong> fires deploy
                automatically when a watched @ posts — no Deploy click needed (requires AI launcher
                toggle on).
              </p>

              <button
                type="button"
                disabled={createMutation.isPending || !draft.name.trim()}
                onClick={() => createMutation.mutate()}
                className="btn-press w-full rounded-sm bg-accent-primary py-2 text-[10px] font-bold uppercase tracking-wide text-fg-inverse hover:bg-accent-glow disabled:opacity-50"
              >
                {createMutation.isPending ? 'Saving…' : 'Save rule'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
