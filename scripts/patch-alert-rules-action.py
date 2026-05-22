from pathlib import Path

p = Path(__file__).resolve().parents[1] / "components/alerts/AlertRulesSection.tsx"
t = p.read_text(encoding="utf-8")

if "AlertBuilderTwitterActionPanel" in t and t.count("AlertBuilderTwitterActionPanel") >= 2:
    print("already patched")
    raise SystemExit(0)

start_marker = '                  <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">'
end_marker = '                  <motionlessTweetMedia className="space-y-2 rounded-xl'
if end_marker not in t:
    end_marker = '                  <div className="space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">'

# Only replace inside twitter listen block (first occurrence after "Action")
action_idx = t.index("{/* Action */}")
start = t.index(start_marker, action_idx)
end = t.index(end_marker, start)

replacement = """                  <AlertBuilderTwitterActionPanel
                    execution={twExecution}
                    onExecutionChange={setTwExecution}
                    buySol={twBuySol}
                    onBuySolChange={setTwBuySol}
                    inputCls={inputCls}
                  />
"""

t = t[:start] + replacement + t[end:]
# Remove stale autoBuyMasterEnabled line if any
t = t.replace("  const autoBuyMasterEnabled = useAutoBuyStore((s) => s.autoBuyEnabled);\n", "")
p.write_text(t, encoding="utf-8")
print("patched ok", start, end)
