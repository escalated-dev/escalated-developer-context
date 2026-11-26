/**
 * The default status transition table from contracts/staff-api-v1.md
 * (Status transitions). The suite assumes the install uses it.
 */
export const DEFAULT_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  open: ['in_progress', 'waiting_on_customer', 'waiting_on_agent', 'escalated', 'resolved', 'closed'],
  in_progress: ['waiting_on_customer', 'waiting_on_agent', 'escalated', 'resolved', 'closed'],
  waiting_on_customer: ['open', 'in_progress', 'resolved', 'closed'],
  waiting_on_agent: ['open', 'in_progress', 'escalated', 'resolved', 'closed'],
  escalated: ['in_progress', 'resolved', 'closed'],
  resolved: ['reopened', 'closed'],
  closed: ['reopened'],
  reopened: ['in_progress', 'waiting_on_customer', 'waiting_on_agent', 'escalated', 'resolved', 'closed'],
  live: ['open', 'resolved', 'closed'],
};

export const STATUSES = Object.keys(DEFAULT_TRANSITIONS);

/** True when the default table allows `from` to `to`. A same-status change is not a transition. */
export function canTransition(from: string, to: string): boolean {
  return DEFAULT_TRANSITIONS[from]?.includes(to) ?? false;
}

// Statuses with side effects beyond the status itself (timestamps, events) are not used as round-trip targets.
const ROUND_TRIP_TARGETS = ['waiting_on_customer', 'in_progress', 'waiting_on_agent', 'open'];

/** A status the ticket can move to and back from, or undefined when there is none. */
export function roundTripTarget(current: string): string | undefined {
  return ROUND_TRIP_TARGETS.find((t) => t !== current && canTransition(current, t) && canTransition(t, current));
}

/** A status the table forbids from `current` but that could be undone if a backend wrongly accepted it. */
export function disallowedTarget(current: string): string | undefined {
  return STATUSES.find((t) => t !== current && !canTransition(current, t) && canTransition(t, current));
}

/**
 * True when applying these status values in order is allowed from `current`
 * and the ticket can then be put back to `current`.
 */
export function statusChainIsRestorable(current: string, values: string[]): boolean {
  let s = current;
  for (const v of values) {
    if (v !== s && !canTransition(s, v)) return false;
    s = v;
  }
  return s === current || canTransition(s, current);
}
