'use client';

import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FeatureAnnouncementModal } from '@/components/onboarding/FeatureAnnouncementModal';
import { useMeQuery } from '@/lib/hooks/useMe';

type PendingAnnouncement = {
  id: string;
  slug: string;
  headline: string;
  description: string;
  videoUrl: string | null;
  showFrom: string;
  showUntil: string | null;
};

export function FeatureAnnouncementGate() {
  const { getAccessToken } = usePointerAuth();
  const qc = useQueryClient();
  const meQ = useMeQuery();

  const pendingQ = useQuery({
    queryKey: ['announcement', 'pending'] as const,
    queryFn: async (): Promise<PendingAnnouncement | null> => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/me/announcements/pending', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('pending_failed');
      const json = (await res.json()) as {
        announcement: PendingAnnouncement | null;
      };
      return json.announcement;
    },
    enabled: Boolean(meQ.data?.onboardingCompletedAt),
    staleTime: 60_000,
  });

  const dismissMu = useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch(`/api/me/announcements/${encodeURIComponent(id)}/dismiss`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('dismiss_failed');
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['announcement', 'pending'] });
    },
  });

  const row = pendingQ.data;
  if (!row) return null;

  return (
    <FeatureAnnouncementModal
      open
      headline={row.headline}
      description={row.description}
      videoUrl={row.videoUrl}
      onGotIt={() => dismissMu.mutate(row.id)}
    />
  );
}
