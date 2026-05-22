from pathlib import Path

p = Path("components/alerts/AlertRulesSection.tsx")
text = p.read_text(encoding="utf-8")

# Remove automation-only conditions blurb (else branch)
old_cond_else = """            ) : (
              <>
                <p className="text-[10px] leading-snug" style={{ color: UI.muted }}>
                  When ingest posts a tweet, we literal-match phrases in the tweet text. Mints can appear in the
                  caption, linked URLs, or attached image CDN URLs (when your rule uses Tweet media settings below).
                  Auto-buy intent is applied only when a mint is resolved and server env allows it.
                </p>
                <div className="border-t border-white/[0.06] pt-3" />
              </>
            )}"""
text = text.replace(old_cond_else, "            ) : null}")

start = text.find("            {/* Action */}")
end = text.find("            <div className=\"border-t border-white/[0.06] pt-3\" />", start)
end = text.find("\n", text.find("            {/* C. Notification */}", start))

pulse_action = """            {creatorKind === 'pulse_launchpad' ? (
              <div className="space-y-2">
                <SectionLabel>Action</SectionLabel>
                <motionlessmotionlessmotionlessdiv className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
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

if start < 0:
    raise SystemExit("action start not found")
notif = text.find("            {/* C. Notification */}", start)
if notif < 0:
    raise SystemExit("notification not found")
text = text[:start] + pulse_action + text[notif:]
p.write_text(text, encoding="utf-8")
print("patched action")
