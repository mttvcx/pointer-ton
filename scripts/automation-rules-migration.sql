-- Generic automation columns on alert_rules + backfill from sol_twitter_listen.
-- Run in Supabase SQL editor, then: NOTIFY pgrst, 'reload schema';

ALTER TABLE alert_rules
  ADD COLUMN IF NOT EXISTS trigger_type text,
  ADD COLUMN IF NOT EXISTS trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS action_type text,
  ADD COLUMN IF NOT EXISTS action_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS activity_filter jsonb NOT NULL DEFAULT '{"tweets":true,"replies":true,"quotes":true,"retweets":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS disable_after_success boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cooldown_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_cap_sol numeric;

CREATE INDEX IF NOT EXISTS alert_rules_automation_active_idx
  ON alert_rules (is_active, trigger_type)
  WHERE trigger_type IS NOT NULL;

-- Backfill twitter listen rules → automation columns (keyword vs image/ca heuristic).
UPDATE alert_rules
SET
  rule_type = 'automation',
  trigger_type = CASE
    WHEN COALESCE(jsonb_array_length(rule_config->'phrases'), 0) > 0 THEN 'keyword'
    WHEN COALESCE(rule_config->>'tweetImageMintMode', 'smart') IN ('smart', 'prefer_media') THEN 'image_match'
    ELSE 'ca_detected'
  END,
  trigger_config = CASE
    WHEN COALESCE(jsonb_array_length(rule_config->'phrases'), 0) > 0 THEN jsonb_build_object(
      'handles', COALESCE(rule_config->'handles', '[]'::jsonb),
      'phrases', COALESCE(rule_config->'phrases', '[]'::jsonb),
      'phraseMatch', COALESCE(rule_config->>'phraseMatch', 'substring')
    )
    WHEN COALESCE(rule_config->>'tweetImageMintMode', 'smart') IN ('smart', 'prefer_media') THEN jsonb_build_object(
      'handles', COALESCE(rule_config->'handles', '[]'::jsonb),
      'tweetImageMintMode', COALESCE(rule_config->>'tweetImageMintMode', 'smart'),
      'openWithTweetMedia', COALESCE((rule_config->>'openWithTweetMedia')::boolean, true)
    )
    ELSE jsonb_build_object(
      'handles', COALESCE(rule_config->'handles', '[]'::jsonb),
      'tweetImageMintMode', COALESCE(rule_config->>'tweetImageMintMode', 'off')
    )
  END,
  action_type = CASE COALESCE(rule_config->>'execution', 'notify')
    WHEN 'auto_buy' THEN 'buy'
    WHEN 'auto_launch' THEN 'deploy'
    ELSE 'notify'
  END,
  action_config = CASE COALESCE(rule_config->>'execution', 'notify')
    WHEN 'auto_buy' THEN jsonb_strip_nulls(jsonb_build_object(
      'buySolPreset', rule_config->'buySolPreset',
      'slippageBps', rule_config->'slippageBps'
    ))
    WHEN 'auto_launch' THEN jsonb_strip_nulls(jsonb_build_object(
      'launchMode', rule_config->'launchMode',
      'launchBuySol', rule_config->'launchBuySol'
    ))
    ELSE jsonb_strip_nulls(jsonb_build_object(
      'openWithTweetMedia', COALESCE((rule_config->>'openWithTweetMedia')::boolean, true),
      'tweetImageMintMode', rule_config->>'tweetImageMintMode'
    ))
  END,
  daily_cap_sol = (rule_config->>'maxSolPerDay')::numeric
WHERE rule_type = 'sol_twitter_listen'
  AND trigger_type IS NULL;

NOTIFY pgrst, 'reload schema';
