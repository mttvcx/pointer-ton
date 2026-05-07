-- Reload PostgREST schema cache after adding/rename/drop columns.
-- Run once in Supabase SQL Editor (Dashboard > SQL > New query) when you see
-- errors like: "Could not find the <column> column of <table> in the schema cache."
--
-- Docs: https://supabase.com/docs/guides/api/rest/refocusing-the-schema-cache
NOTIFY pgrst, 'reload schema';
