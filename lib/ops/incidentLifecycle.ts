/**
 * Incident lifecycle — pure state machine (no I/O, unit-testable). Incidents are
 * auto-OPENED by `ops_open_incident`; this defines how an operator drives them to
 * resolution. The DB I/O lives in `lib/db/opsIncidents.ts`.
 *
 * Status flow:  open → acknowledged → investigating → mitigated → resolved
 * (resolved can be reopened; most forward skips are allowed so an operator can
 * jump straight to resolved on a false alarm). "Owner" (assignment) is orthogonal
 * to status.
 */

export type IncidentStatus = 'open' | 'acknowledged' | 'investigating' | 'mitigated' | 'resolved';

export const INCIDENT_STATUSES: readonly IncidentStatus[] = [
  'open',
  'acknowledged',
  'investigating',
  'mitigated',
  'resolved',
];

export type IncidentAction = 'acknowledge' | 'investigate' | 'mitigate' | 'resolve' | 'reopen';

/** Valid next-states from each status. */
const TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  open: ['acknowledged', 'investigating', 'mitigated', 'resolved'],
  acknowledged: ['investigating', 'mitigated', 'resolved'],
  investigating: ['mitigated', 'resolved'],
  mitigated: ['investigating', 'resolved'],
  resolved: ['open'],
};

const ACTION_TARGET: Record<IncidentAction, IncidentStatus> = {
  acknowledge: 'acknowledged',
  investigate: 'investigating',
  mitigate: 'mitigated',
  resolve: 'resolved',
  reopen: 'open',
};

export function canTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  if (from === to) return false;
  return (TRANSITIONS[from] ?? []).includes(to);
}

/** The status an action moves to, or null if the action isn't valid from here. */
export function applyAction(status: IncidentStatus, action: IncidentAction): IncidentStatus | null {
  const target = ACTION_TARGET[action];
  return canTransition(status, target) ? target : null;
}

/** Actions available from the current status (for the UI). */
export function availableActions(status: IncidentStatus): IncidentAction[] {
  return (Object.keys(ACTION_TARGET) as IncidentAction[]).filter(
    (a) => applyAction(status, a) !== null,
  );
}

export const isResolved = (status: IncidentStatus): boolean => status === 'resolved';
export const isActive = (status: IncidentStatus): boolean => status !== 'resolved';

/** A timeline entry appended on every transition / note. */
export type IncidentTimelineEntry = {
  at: string;
  actor: string;
  kind: 'status' | 'note' | 'assign';
  from?: IncidentStatus;
  to?: IncidentStatus;
  note?: string;
};
