/**
 * Task R — sample content for the embedded co-pilot panel.
 *
 * Hard-coded for the visual milestone. A follow-up task wires this to the
 * real co-pilot pipeline (hovered entity → /api/ai/explain-token, alerts
 * ticker, etc.). Keep the field names stable so the swap is mechanical.
 */

export const SAMPLE_INSIGHT = {
  status: 'idle' as const, // 'idle' | 'watching' | 'armed'
  contextLine: 'Hover a token row for instant AI context.',
  suggestions: ['rug pull risk', 'bonding curve', 'LP locked', 'top holders', 'bundle risk'],
};

export const SAMPLE_ACTION_CHIPS = [
  { id: 'explain', label: 'Explain token' },
  { id: 'risks', label: 'Find risks' },
  { id: 'alert', label: 'Build alert' },
  { id: 'recap', label: 'Recap' },
];
