'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { ChevronDown, ChevronRight, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { CopyButton } from '@/components/shared/CopyButton';

type TrackerRow = {
  id: string;
  walletAddress: string;
  label: string | null;
};

type RuleRow = {
  id: string;
  nlText: string;
  summary: string;
  condition: unknown;
  enabled: boolean;
  createdAt: string;
};

export function TrackerRulesSection({ tracker }: { tracker: TrackerRow }) {
  const { authenticated, getAccessToken } = usePointerAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nl, setNl] = useState('');
  const [preview, setPreview] = useState<{ summary: string; condition: unknown } | null>(null);

  const rulesQ = useQuery({
    queryKey: ['tracker-rules', tracker.id],
    enabled: open && authenticated,
    queryFn: async (): Promise<RuleRow[]> => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch(
        `/api/trackers/rules?trackedWalletId=${encodeURIComponent(tracker.id)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const json: unknown = await res.json();
      if (!res.ok) throw new Error('rules_list_failed');
      return (json as { rules: RuleRow[] }).rules;
    },
  });

  const parseMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/trackers/rules/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ trackedWalletId: tracker.id, nlText: nl }),
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof json === 'object' && json && 'message' in json
            ? String((json as { message: unknown }).message)
            : 'parse failed',
        );
      }
      return json as { summary: string; condition: unknown };
    },
    onSuccess: (data) => {
      setPreview(data);
      toast.success("Rule understood - review below, then save.");
    },
    onError: (e: Error) => {
      console.error('[TrackerRulesSection] parse rule', e);
      toast.error('Couldn’t read that rule — please try again');
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/trackers/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ trackedWalletId: tracker.id, nlText: nl.trim() }),
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof json === 'object' && json && 'message' in json
            ? String((json as { message: unknown }).message)
            : 'save failed',
        );
      }
    },
    onSuccess: () => {
      setNl('');
      setPreview(null);
      void queryClient.invalidateQueries({ queryKey: ['tracker-rules', tracker.id] });
      toast.success('Rule saved');
    },
    onError: (e: Error) => {
      console.error('[TrackerRulesSection] save rule', e);
      toast.error('Couldn’t save rule — please try again');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch(`/api/trackers/rules/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error('toggle failed');
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['tracker-rules', tracker.id] }),
    onError: (e: Error) => {
      console.error('[TrackerRulesSection] toggle rule', e);
      toast.error('Couldn’t update rule — please try again');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch(`/api/trackers/rules/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('delete failed');
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['tracker-rules', tracker.id] }),
    onError: (e: Error) => {
      console.error('[TrackerRulesSection] delete rule', e);
      toast.error('Couldn’t delete rule — please try again');
    },
  });

  return (
    <div className="border-t border-border-subtle">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="focus-ring flex w-full items-center gap-2 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.02em] text-fg-muted transition hover:text-fg-secondary"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        Alert rules
        {rulesQ.data ? (
          <span className="ml-auto rounded border border-border-subtle px-1 py-px tabular-nums text-[9px] tabular-nums">
            {rulesQ.data.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="space-y-3 pb-3 pl-5">
          <p className="text-[11px] leading-snug text-fg-secondary">
            Describe what you want in plain English. Example:{' '}
            <span className="text-fg-muted">
              &ldquo;Only TON launchpad launches&rdquo; or &ldquo;Any new token from this wallet&rdquo;.
            </span>
          </p>

          <div className="space-y-2">
            <textarea
              value={nl}
              onChange={(e) => setNl(e.target.value)}
              rows={3}
              placeholder="e.g. Alert me only when they launch on the TON launchpad"
              className="focus-ring w-full resize-y rounded-md border border-border-subtle bg-bg-base px-3 py-2 text-[13px] text-fg-primary placeholder:text-fg-muted hover:border-border-default focus:border-accent-primary/60"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={parseMutation.isPending || nl.trim().length < 4}
                onClick={() => parseMutation.mutate()}
                className="btn-press focus-ring inline-flex items-center gap-1.5 rounded-md border border-border-subtle px-3 py-1.5 text-[11px] font-semibold text-fg-primary transition hover:border-border-default disabled:opacity-50"
              >
                {parseMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Preview parse
              </button>
              <button
                type="button"
                disabled={saveMutation.isPending || nl.trim().length < 4}
                onClick={() => saveMutation.mutate()}
                className="btn-press focus-ring rounded-md bg-accent-primary px-3 py-1.5 text-[11px] font-semibold text-fg-inverse transition hover:bg-accent-glow disabled:opacity-50"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="inline h-3.5 w-3.5 animate-spin" />
                ) : null}
                Save rule
              </button>
            </div>
          </div>

          {preview ? (
            <div className="rounded-md border border-border-subtle bg-bg-base p-2 text-[11px] leading-snug">
              <div className="font-medium text-fg-primary">{preview.summary}</div>
              <pre className="mt-2 max-h-32 overflow-auto tabular-nums text-[10px] text-fg-muted">
                {JSON.stringify(preview.condition, null, 2)}
              </pre>
              <CopyButton
                value={JSON.stringify(preview.condition)}
                label="Copy condition JSON"
                toastLabel="Condition copied"
                className="mt-2 text-[10px] text-accent-primary"
              >
                Copy JSON
              </CopyButton>
            </div>
          ) : null}

          {rulesQ.isLoading ? (
            <div className="flex items-center gap-2 text-[11px] text-fg-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading rules...
            </div>
          ) : rulesQ.data && rulesQ.data.length > 0 ? (
            <ul className="space-y-2">
              {rulesQ.data.map((r) => (
                <li
                  key={r.id}
                  className="rounded-md border border-border-subtle bg-bg-base p-2 text-[11px] leading-snug"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-fg-primary">{r.summary}</div>
                      <p className="mt-0.5 text-fg-muted">&ldquo;{r.nlText}&rdquo;</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <label className="flex cursor-pointer items-center gap-1 text-[10px] text-fg-muted">
                        <input
                          type="checkbox"
                          checked={r.enabled}
                          disabled={toggleMutation.isPending}
                          onChange={(e) =>
                            toggleMutation.mutate({ id: r.id, enabled: e.target.checked })
                          }
                          className="rounded border-border-subtle"
                        />
                        On
                      </label>
                      <button
                        type="button"
                        aria-label="Delete rule"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(r.id)}
                        className="focus-ring rounded border border-border-subtle p-1 text-fg-muted hover:border-signal-bear/40 hover:text-signal-bear"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-fg-muted">No custom rules - default launch alerts apply.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
