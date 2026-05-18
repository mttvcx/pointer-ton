import { extractSolMintCandidates } from '@/lib/alerts/solMintFromText';
import type { TweetImageMintMode } from '@/lib/alerts/alertRuleModel';

export function mintCandidatesFromTweetParts(
  text: string,
  linkUrls: string[] | undefined,
  imageUrls: string[] | undefined,
) {
  const textBlob = `${text ?? ''}\n${(linkUrls ?? []).join('\n')}`;
  const mediaBlob = `${(imageUrls ?? []).join('\n')}`;
  return {
    textCandidates: extractSolMintCandidates(textBlob),
    mediaCandidates: extractSolMintCandidates(mediaBlob),
  };
}

/** Pick primary mint + flat candidate list for alerts / auto-buy intent. */
export function pickTwitterListenMint(
  mode: TweetImageMintMode | undefined,
  textCandidates: string[],
  mediaCandidates: string[],
  hasPostImages: boolean,
): { mint: string | null; mintCandidates: string[] } {
  const m = mode ?? 'off';
  if (m === 'off') {
    return { mint: textCandidates[0] ?? null, mintCandidates: textCandidates };
  }

  const merged: string[] = [];
  const seen = new Set<string>();
  for (const c of [...textCandidates, ...mediaCandidates]) {
    if (seen.has(c)) continue;
    seen.add(c);
    merged.push(c);
  }

  if (m === 'prefer_media' && hasPostImages && mediaCandidates.length > 0) {
    return {
      mint: mediaCandidates[0] ?? textCandidates[0] ?? null,
      mintCandidates: merged,
    };
  }

  return {
    mint: textCandidates[0] ?? mediaCandidates[0] ?? null,
    mintCandidates: merged,
  };
}
