/**
 * Backends MAY restrict status changes, and their tables differ, so the suite
 * never assumes one. It tries candidates and treats a 422 with errors.status as
 * "not allowed from here". See contracts/staff-api-v1.md, Status transitions.
 */
export const STATUSES = [
  'open',
  'in_progress',
  'waiting_on_customer',
  'waiting_on_agent',
  'escalated',
  'resolved',
  'closed',
  'reopened',
  'live',
] as const;

/**
 * Statuses tried for a round trip, in order. Statuses with side effects beyond
 * the status itself (resolved_at, closed_at, escalation events) are left out.
 */
export const ROUND_TRIP_CANDIDATES = ['waiting_on_customer', 'in_progress', 'waiting_on_agent', 'open'] as const;

/** True when a response is the contract's refusal of a status change: 422 with errors.status. */
export function isRefusedTransition(res: { status: number; json: any }): boolean {
  return res.status === 422 && res.json?.errors != null && typeof res.json.errors === 'object' && 'status' in res.json.errors;
}
