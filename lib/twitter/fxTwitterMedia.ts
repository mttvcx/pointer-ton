type FxMediaItem = {
  type?: string;
  url?: string;
  thumbnail_url?: string;
};

type FxMedia = {
  photos?: FxMediaItem[];
  videos?: FxMediaItem[];
  all?: FxMediaItem[];
  mosaic?: { formats?: { jpeg?: string; webp?: string } };
};

function pushUnique(urls: string[], url: string | undefined) {
  const u = url?.trim();
  if (!u || urls.includes(u)) return;
  urls.push(u);
}

export function parseFxTwitterMedia(media: FxMedia | FxMediaItem[] | undefined): string[] {
  if (!media) return [];
  const urls: string[] = [];

  if (Array.isArray(media)) {
    for (const item of media) pushUnique(urls, item.url ?? item.thumbnail_url);
    return urls;
  }

  pushUnique(urls, media.mosaic?.formats?.jpeg ?? media.mosaic?.formats?.webp);
  for (const p of media.photos ?? []) pushUnique(urls, p.url);
  for (const v of media.videos ?? []) pushUnique(urls, v.thumbnail_url ?? v.url);
  for (const item of media.all ?? []) {
    if (item.type === 'photo') pushUnique(urls, item.url);
    else pushUnique(urls, item.thumbnail_url ?? item.url);
  }
  return urls;
}
