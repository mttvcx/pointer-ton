/**
 * Optional structured update payload stored in Supabase `announcements.description`.
 *
 * Plain text `description` = single slide (backward compatible).
 *
 * Advanced (JSON): multiple features with matching demo videos — same row `headline` is the modal title,
 * `video_url` is ignored when JSON includes per-slide urls (omit or null).
 *
 * @example
 * ```json
 * {
 *   "version": 1,
 *   "badge": "v0.24.0",
 *   "slides": [
 *     { "id": "pulse", "title": "Pulse columns", "description": "…", "videoUrl": "https://…mp4" }
 *   ]
 * }
 * ```
 */
export type FeatureAnnouncementSlide = {
  id: string;
  title: string;
  description: string;
  /** MP4/WebM preferred for in-modal player; YouTube watch URL embeds via iframe */
  videoUrl: string | null;
};

export type FeatureAnnouncementCarouselPayload = {
  version: 1;
  /** Optional footer badge shown next to “See previous updates” */
  badge?: string;
  slides: FeatureAnnouncementSlide[];
};

export type NormalizedAnnouncement = {
  title: string;
  badge?: string | null;
  slides: FeatureAnnouncementSlide[];
  /** Multi-item JSON payload (vs plain-text single announcement) */
  carousel: boolean;
};

function tryParseCarousel(rawDescription: string): FeatureAnnouncementCarouselPayload | null {
  const t = rawDescription.trim();
  if (!t.startsWith('{')) return null;
  try {
    const j = JSON.parse(t) as unknown;
    if (!j || typeof j !== 'object') return null;
    const obj = j as Record<string, unknown>;
    if (obj.version !== 1) return null;
    const slides = obj.slides;
    if (!Array.isArray(slides) || slides.length === 0) return null;
    const normalized: FeatureAnnouncementSlide[] = [];
    for (const s of slides) {
      if (!s || typeof s !== 'object') continue;
      const r = s as Record<string, unknown>;
      const id = typeof r.id === 'string' && r.id.trim() ? r.id.trim() : `slide-${normalized.length}`;
      const title = typeof r.title === 'string' ? r.title : '';
      const description = typeof r.description === 'string' ? r.description : '';
      const videoUrl =
        typeof r.videoUrl === 'string' && r.videoUrl.trim() ? r.videoUrl.trim()
        : typeof r.video_url === 'string' && r.video_url.trim()
          ? r.video_url.trim()
          : null;
      if (!title.trim()) continue;
      normalized.push({ id, title, description, videoUrl });
    }
    return normalized.length > 0 ? { version: 1, badge: typeof obj.badge === 'string' ? obj.badge : undefined, slides: normalized } : null;
  } catch {
    return null;
  }
}

/** Turn DB row fields into canonical slide list + title + optional badge */
export function normalizeAnnouncementInput(params: {
  headline: string;
  description: string;
  videoUrl: string | null;
}): NormalizedAnnouncement {
  const carousel = tryParseCarousel(params.description);
  if (carousel) {
    return {
      title: params.headline.trim() || 'What’s new',
      badge: carousel.badge ?? null,
      slides: carousel.slides,
      carousel: true,
    };
  }

  const head = params.headline.trim() || 'What’s new';
  const body = params.description.trim();
  return {
    title: head,
    badge: null,
    slides: [
      {
        id: 'single',
        title: head,
        description: body,
        videoUrl: params.videoUrl,
      },
    ],
    carousel: false,
  };
}
