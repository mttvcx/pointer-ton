/**
 * AI pipeline output types land here in Step 8 (Zod-inferred / hand-narrowed).
 * Until then, use `Json` from the database module for persisted `ai_responses`.
 */
export type { Json as AiDocument } from '@/lib/supabase/types';
