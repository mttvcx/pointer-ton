from pathlib import Path

p = Path("components/alerts/AlertRulesSection.tsx")
lines = p.read_text(encoding="utf-8").splitlines(keepends=True)

start = next(i for i, l in enumerate(lines) if "{creatorKind === 'sol_twitter_listen' ? (" in l)
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
p.write_text("".join(lines), encoding="utf-8")
print("patched", start + 1, "to", end + 1)
