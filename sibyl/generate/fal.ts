/**
 * Sibyl image/video generation via fal.ai (https://fal.run/{model}).
 * Env: FAL_KEY (required). Optional overrides SIBYL_FAL_IMAGE_MODEL / SIBYL_FAL_VIDEO_MODEL
 * force a specific fal model id regardless of the label the app sent.
 *
 * NOTE: fal's catalog evolves — if a model id 404s, swap it here or set the env override.
 */

const FAL_IMAGE: Record<string, string> = {
  'FLUX.1 Schnell': 'fal-ai/flux/schnell',
  'FLUX.1 Dev': 'fal-ai/flux/dev',
  SDXL: 'fal-ai/fast-sdxl',
  'Z-Image Turbo': 'fal-ai/flux/schnell',
  'Grok Image Private': 'fal-ai/flux/schnell',
};

const FAL_VIDEO: Record<string, string> = {
  'Seedance 2.0': 'fal-ai/bytedance/seedance/v1/lite/text-to-video',
  'Seedance 2.0 Fast': 'fal-ai/bytedance/seedance/v1/lite/text-to-video',
  'HappyHorse 1.1': 'fal-ai/ltx-video',
  'HappyHorse 1.0': 'fal-ai/ltx-video',
  'Grok Imagine Private': 'fal-ai/ltx-video',
  'LTX Video 2.0 Fast': 'fal-ai/ltx-video',
  'Veo 3.1 Fast': 'fal-ai/veo3/fast',
  'Veo 3.1 Full Quality': 'fal-ai/veo3',
  'PixVerse v5.6': 'fal-ai/pixverse/v4.5/text-to-video',
  'Runway Gen-4.5': 'fal-ai/runway-gen4/turbo',
};

const IMAGE_DEFAULT = 'fal-ai/flux/schnell';
const VIDEO_DEFAULT = 'fal-ai/ltx-video';

export function falConfigured(): boolean {
  return Boolean(process.env.FAL_KEY);
}

export function aspectToImageSize(ar?: string): string {
  switch (ar) {
    case 'Portrait (3:4)':
      return 'portrait_4_3';
    case 'Landscape (4:3)':
      return 'landscape_4_3';
    case 'Wide (16:9)':
      return 'landscape_16_9';
    case 'Tall (9:16)':
      return 'portrait_16_9';
    default:
      return 'square_hd';
  }
}

async function callFal(modelId: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const key = process.env.FAL_KEY!;
  const res = await fetch(`https://fal.run/${modelId}`, {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`fal_${res.status}:${text.slice(0, 200)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

/** Generate an image. Returns the first result URL. */
export async function falImage(label: string | undefined, prompt: string, aspectRatio?: string): Promise<string> {
  const modelId = process.env.SIBYL_FAL_IMAGE_MODEL || FAL_IMAGE[label ?? ''] || IMAGE_DEFAULT;
  const data = await callFal(modelId, { prompt, image_size: aspectToImageSize(aspectRatio), num_images: 1 });
  const images = data.images as { url?: string }[] | undefined;
  const url = images?.[0]?.url ?? (data.image as { url?: string } | undefined)?.url;
  if (!url) throw new Error('fal_no_image');
  return url;
}

/** Generate a short video. Returns the video URL. */
export async function falVideo(label: string | undefined, prompt: string, aspectRatio?: string, resolution?: string): Promise<string> {
  const modelId = process.env.SIBYL_FAL_VIDEO_MODEL || FAL_VIDEO[label ?? ''] || VIDEO_DEFAULT;
  const ar = aspectRatio?.includes('9:16') ? '9:16' : aspectRatio?.includes('1:1') ? '1:1' : '16:9';
  const data = await callFal(modelId, { prompt, aspect_ratio: ar, resolution: (resolution ?? '720p').replace('p', '') });
  const video = data.video as { url?: string } | undefined;
  const url = video?.url ?? (data.output as { url?: string } | undefined)?.url;
  if (!url) throw new Error('fal_no_video');
  return url;
}
