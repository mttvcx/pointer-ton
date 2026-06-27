import type {
  DoctorFinding,
  DoctorReport,
  DoctorSeverity,
  OpsHealthSnapshot,
} from '@/lib/admin/opsTypes';

/**
 * Pointer Doctor — a READ-ONLY, deterministic investigator. It correlates the
 * live health snapshot (trading, pulse, indexer, crons, providers, incidents)
 * into a plain-English diagnosis. No LLM (zero credit risk), no actions taken —
 * it only explains. Self-heal lives elsewhere and stays gated.
 */

function ageStr(min: number): string {
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function diagnose(snap: Omit<OpsHealthSnapshot, 'doctor'>): DoctorReport {
  const f: DoctorFinding[] = [];

  // 1) Critical providers with no credentials.
  for (const p of snap.providers) {
    if (p.critical && !p.configured) {
      f.push({
        id: `provider-unconfigured-${p.key}`,
        severity: 'critical',
        title: `${p.label} not configured`,
        detail: `A critical provider (${p.label}) has no credentials set — anything depending on it will fail.`,
        action: 'Set its env var(s) in Vercel and redeploy.',
      });
    }
  }

  // 2) Health collectors that errored (never fake — surface the gap).
  const readErrors: [string, unknown][] = [
    ['Trading', snap.trading],
    ['Indexer', snap.indexer],
    ['Pulse', snap.pulse],
    ['Helius', snap.helius],
    ['Crons', snap.crons],
    ['Incidents', snap.incidents],
  ];
  for (const [name, sec] of readErrors) {
    if (sec && typeof sec === 'object' && (sec as { ok?: boolean }).ok === false) {
      f.push({
        id: `section-${name}`,
        severity: 'warn',
        title: `${name} signal unreadable`,
        detail: `The ${name} collector errored: ${(sec as { error?: string }).error ?? 'unknown'}.`,
        action: 'Check DB connectivity / the collector query.',
      });
    }
  }

  const provInc = Array.isArray(snap.incidents)
    ? snap.incidents.filter((i) => i.category === 'provider')
    : [];

  // 3) Trade failure rate (correlate with provider incidents).
  if (snap.trading.ok) {
    const t = snap.trading;
    const fills = t.confirmed + t.failed;
    if (t.failRatePct != null && fills >= 5) {
      const provNote = provInc.length ? ` Open provider incidents: ${provInc.map((i) => i.name).join(', ')}.` : '';
      if (t.failRatePct >= 20) {
        f.push({
          id: 'trade-failrate',
          severity: 'critical',
          title: `Trade failure rate ${t.failRatePct.toFixed(0)}%`,
          detail: `${t.failed}/${fills} trades failed in the last ${t.windowHours}h.${provNote}`,
          action: provInc.length ? 'Likely an upstream provider — see the provider incidents.' : 'Check trade.broadcast events + RPC health.',
        });
      } else if (t.failRatePct >= 8) {
        f.push({
          id: 'trade-failrate',
          severity: 'warn',
          title: `Trade failure rate elevated (${t.failRatePct.toFixed(0)}%)`,
          detail: `${t.failed}/${fills} trades failed in the last ${t.windowHours}h.${provNote}`,
          action: 'Watch broadcast + Jupiter; investigate if it climbs.',
        });
      }
    }
  }

  // 4) Pulse ingest stale (correlate with discovery crons).
  if (snap.pulse.ok && snap.pulse.ageMinutes != null && snap.pulse.ageMinutes > 45) {
    const age = snap.pulse.ageMinutes;
    const cronErr = Array.isArray(snap.crons)
      ? snap.crons.filter((c) => c.status === 'error' && /discover|pulse|index/i.test(c.name))
      : [];
    const note = cronErr.length ? ` Failing ingest crons: ${cronErr.map((c) => c.name).join(', ')}.` : '';
    f.push({
      id: 'pulse-stale',
      severity: age > 120 ? 'critical' : 'warn',
      title: `Pulse ingest stale — last token ${ageStr(age)} ago`,
      detail: `No new tokens discovered in ${ageStr(age)}.${note}`,
      action: cronErr.length ? 'Re-run the failing discovery cron.' : 'Check discover-tokens / pulse-poll crons + Helius.',
    });
  }

  // 5) Indexer backlog.
  if (snap.indexer.ok) {
    const failed = snap.indexer.byStatus.failed ?? 0;
    if (failed >= 25) {
      f.push({
        id: 'indexer-failed',
        severity: failed >= 100 ? 'critical' : 'warn',
        title: `Indexer failures: ${failed}`,
        detail: `${failed} mints are in a failed index state.`,
        action: 'Run retry-failed-indexes; inspect recent failures.',
      });
    }
  }

  // 6) Errored / very stale crons.
  if (Array.isArray(snap.crons)) {
    for (const c of snap.crons) {
      if (c.status === 'error') {
        f.push({
          id: `cron-error-${c.name}`,
          severity: 'warn',
          title: `Cron "${c.name}" failed`,
          detail: `Last run errored ${ageStr(c.ageMinutes)} ago.`,
          action: 'Check the cron route + its event detail.',
        });
      } else if (c.ageMinutes > 180) {
        f.push({
          id: `cron-stale-${c.name}`,
          severity: 'warn',
          title: `Cron "${c.name}" stale`,
          detail: `No run recorded in ${ageStr(c.ageMinutes)}.`,
          action: 'Verify the Vercel cron schedule is firing.',
        });
      }
    }
  }

  // 7) Open critical incidents not otherwise surfaced.
  if (Array.isArray(snap.incidents)) {
    for (const inc of snap.incidents) {
      if (inc.severity === 'critical') {
        f.push({
          id: `incident-${inc.id}`,
          severity: 'critical',
          title: `Critical incident: ${inc.name}`,
          detail: `${inc.category} · seen ${inc.count}× · ${inc.sampleMessage ?? 'no message'}`,
          action: 'Investigate the source; resolve once cleared.',
        });
      }
    }
  }

  const criticals = f.filter((x) => x.severity === 'critical').length;
  const warns = f.length - criticals;
  const status: DoctorSeverity = criticals > 0 ? 'critical' : warns > 0 ? 'warn' : 'ok';
  const summary =
    status === 'ok'
      ? 'All monitored signals look healthy.'
      : status === 'critical'
        ? `${criticals} critical${warns ? ` + ${warns} warning${warns > 1 ? 's' : ''}` : ''} to look at.`
        : `${warns} warning${warns > 1 ? 's' : ''} — nothing critical.`;

  return { status, summary, findings: f, checkedAt: snap.generatedAt };
}
