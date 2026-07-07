import 'server-only';

/**
 * Server-side metadata prep for EVM pads that need it:
 *  - zora-creator wants a JSON metadata URI (EIP-7572) → we reuse pump.fun's IPFS
 *    endpoint (returns a metadataUri pointing at name/symbol/description/image JSON).
 *  - flaunch wants a base64 image → we fetch the image and inline it.
 *
 * Runs server-side to avoid browser CORS on the IPFS upload + image fetch. Both
 * fields are best-effort; a pad that requires one throws downstream if it's null.
 */

const PUMP_IPFS_URL = 'https://pump.fun/api/ipfs';

export type EvmLaunchMetaInput = {
  name: string;
  symbol: string;
  description?: string | null;
  imageUrl?: string | null;
  twitter?: string | null;
  website?: string | null;
};

export async function buildEvmLaunchMeta(
  input: EvmLaunchMetaInput,
): Promise<{ metadataUri: string | null; base64Image: string | null }> {
  let base64Image: string | null = null;
  const form = new FormData();

  if (input.imageUrl) {
    try {
      const r = await fetch(input.imageUrl, { signal: AbortSignal.timeout(10_000) });
      if (r.ok) {
        const ab = await r.arrayBuffer();
        const contentType = r.headers.get('content-type') || 'image/png';
        base64Image = `data:${contentType};base64,${Buffer.from(ab).toString('base64')}`;
        form.append('file', new Blob([ab], { type: contentType }), 'image.png');
      }
    } catch {
      /* image is best-effort */
    }
  }

  form.append('name', input.name);
  form.append('symbol', input.symbol);
  form.append('description', input.description ?? '');
  form.append('twitter', input.twitter ?? '');
  form.append('website', input.website ?? '');
  form.append('showName', 'true');

  let metadataUri: string | null = null;
  try {
    const res = await fetch(PUMP_IPFS_URL, { method: 'POST', body: form, signal: AbortSignal.timeout(20_000) });
    if (res.ok) {
      const j = (await res.json()) as { metadataUri?: string };
      metadataUri = j.metadataUri ?? null;
    }
  } catch {
    /* metadata upload is best-effort */
  }

  return { metadataUri, base64Image };
}
