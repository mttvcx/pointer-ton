/**
 * Onramper integration surface for Pointer ramps.
 *
 * Prefer importing from here in app code rather than reaching into internals.
 */

export {
  buildOnramperWidgetUrl,
  canonicalOnramperSignContent,
  type BuildOnramperWidgetInput,
  type BuiltOnramperWidget,
} from '@/lib/onramper/buildOnramperWidgetUrl';

export { fundingForChain, CHAIN_FUNDING, type ChainFundingConfig } from '@/lib/onramper/chainFundingConfig';
