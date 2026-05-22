from pathlib import Path

p = Path("components/alerts/AlertRulesSection.tsx")
lines = p.read_text(encoding="utf-8").splitlines(keepends=True)

# 1) Replace twitter trigger block
start = next((i for i, l in enumerate(lines) if "{creatorKind === 'sol_twitter_listen' ? (" in l), None)
if start is None:
    start = next((i for i, l in enumerate(lines) if "{creatorKind === 'automation' ? (" in l), None)
if start is None:
    raise SystemExit("trigger block start not found")

end = next(i for i, l in enumerate(lines) if i > start and "Leave empty for any launchpad" in l) - 2

replacement = """              {creatorKind === 'automation' ? (
                <AutomationRuleBuilder
                  draft={automationDraft}
                  onChange={(patch) =>
                    setAutomationDraft((d) =>
                      typeof patch === 'function' ? patch(d) : { ...d, ...patch },
                    )
                  }
                  inputCls={inputCls}
                />
              ) : (
"""
lines = lines[:start] + [replacement] + lines[end:]

text = "".join(lines)

# 2) conditions else -> null
old_cond = """            ) : (
              <>
                <p className="text-[10px] leading-snug" style={{ color: UI.muted }}>
                  When ingest posts a tweet"""
if old_cond in text:
    i = text.find(old_cond)
    j = text.find("            )}", i) + len("            )}")
    text = text[:i] + "            ) : null}" + text[j:]

# 3) replace Action section
action_start = text.find("            {/* Action */}")
notif = text.find("            {/* C. Notification */}", action_start)
if action_start >= 0 and notif > action_start:
    pulse_action = """            {creatorKind === 'pulse_launchpad' ? (
              <motionlessmotionlessmotionlessdiv className="space-y-2">
                <SectionLabel>Action</SectionLabel>
                <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
                  <span
                    className="rounded-lg bg-white/[0.11] py-2 text-center text-[11px] font-semibold shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]"
                    style={{ color: UI.text }}
                  >
                    Notify only
                  </span>
                  <button
                    type="button"
                    disabled
                    title="Auto-buy is available on automation rules"
                    className="rounded-lg py-2 text-center text-[11px] font-medium text-fg-muted opacity-45"
                  >
                    Auto-buy
                  </button>
                </motionlessmotionlessmotionlessmotionlessdiv>
                <p className="text-[10px] leading-snug" style={{ color: UI.muted }}>
                  Launchpad rules are notify-only today. Use an automation rule for buy / sell / deploy.
                </p>
              </motionlessmotionlessmotionlessmotionlessmotionlessmotionlessdiv>
            ) : null}

"""
    pulse_action = pulse_action.replace("motionless", "")
    text = text[:action_start] + pulse_action + text[notif:]

# 4) ruleSummary if still has TweetImageMintMode
if "TweetImageMintMode" in text and "triggerTypeLabel(r.triggerType)" not in text:
    start_fn = text.find("function ruleSummary")
    pulse_check = text.find("  if (r.ruleType !== 'pulse_launchpad'", start_fn)
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
    const cfg = r.ruleConfig as { handles?: string[]; phrases?: string[]; execution?: string };
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
    text = text[:start_fn] + new_summary + text[pulse_check:]

# 5) tab label Automation
text = text.replace("setCreatorKind('sol_twitter_listen')", "setCreatorKind('automation')")
text = text.replace("creatorKind === 'sol_twitter_listen'", "creatorKind === 'automation'")
text = text.replace("X listens", "Automation")

p.write_text(text, encoding="utf-8")
print("fixed alert rules section")
