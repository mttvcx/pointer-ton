from pathlib import Path

p = Path("components/alerts/AlertRulesSection.tsx")
t = p.read_text(encoding="utf-8")

old_cond = """            ) : (
              <>
                <p className="text-[10px] leading-snug" style={{ color: UI.muted }}>
                  When ingest posts a tweet, we literal-match phrases in the tweet text. Mints can appear in the
                  caption, linked URLs, or attached image CDN URLs (when your rule uses Tweet media settings below).
                  Auto-buy intent is applied only when a mint is resolved and server env allows it.
                </p>
                <motionlessmotionlessmotionlessdiv className="border-t border-white/[0.06] pt-3" />
              </>
            )}"""
old_cond = old_cond.replace("motionless", "")
if old_cond in t:
    t = t.replace(old_cond, "            ) : null}")
    print("fixed cond")
else:
  # try without motionless typo
    old2 = old_cond.replace('<div className="border-t', '<div className="border-t')
    if """When ingest posts a tweet""" in t:
        i = t.find("            ) : (\n              <>\n                <p className=\"text-[10px]")
        if i >= 0:
            j = t.find("            )}", i) + len("            )}")
            t = t[:i] + "            ) : null}" + t[j:]
            print("fixed cond slice")

new_summary = '''function ruleSummary(r: RuleDto, chain: AppChainId): string {
  if (
    (r.ruleType === 'automation' || r.ruleType === 'sol_twitter_listen') &&
    r.triggerType &&
    r.actionType
  ) {
    const handles =
      r.triggerConfig &&
      typeof r.triggerConfig === 'object' &&
      'handles' in (r.triggerConfig as object)
        ? ((r.triggerConfig as { handles?: string[] }).handles ?? [])
        : [];
    const h = handles.length ? `@${handles.slice(0, 2).join(', @')}` : 'handles';
    return `${triggerTypeLabel(r.triggerType)} · ${actionTypeLabel(r.actionType)} · ${h}`;
  }
  if (r.ruleType === 'sol_twitter_listen' && r.ruleConfig && typeof r.ruleConfig === 'object') {
    const cfg = r.ruleConfig as {
      handles?: string[];
      phrases?: string[];
      execution?: string;
    };
    const h = cfg.handles?.length ? `@${cfg.handles.slice(0, 3).join(', @')}` : 'handles';
    const ph = cfg.phrases?.length ? ` · phrases ${cfg.phrases.length}` : ' · any text';
    const exe =
      cfg.execution === 'auto_buy'
        ? ' · auto-buy'
        : cfg.execution === 'auto_launch'
          ? ' · auto-launch'
          : '';
    return `X listen · ${h}${ph}${exe}`;
  }
'''

start = t.find("function ruleSummary")
if start < 0:
    raise SystemExit("ruleSummary not found")
# find end of function - next line at col 0 starting with }
brace = t.find("\n}", start)
# find function end by counting - simpler: find "if (r.ruleType !== 'pulse_launchpad'"
pulse_check = t.find("  if (r.ruleType !== 'pulse_launchpad'", start)
if pulse_check < 0:
    raise SystemExit("pulse check not found")
t = t[:start] + new_summary + t[pulse_check:]
p.write_text(t, encoding="utf-8")
print("patched summary")
