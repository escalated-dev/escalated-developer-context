export interface ConformanceEnv {
  /** Full API base, e.g. http://localhost:8000/support/api/v1 (no trailing slash). */
  baseUrl: string;
  agentToken: string;
  adminToken?: string;
}

/** The API base URL alone, for calls that need no token (GET /meta). */
export function baseUrl(): string {
  const url = process.env.ESCALATED_CONFORMANCE_URL?.trim();
  if (!url) {
    throw new Error(
      'ESCALATED_CONFORMANCE_URL is not set. Set it to the API base, e.g. http://localhost:8000/support/api/v1',
    );
  }
  return url.replace(/\/+$/, '');
}

export function env(): ConformanceEnv {
  const base = baseUrl();
  const agentToken = process.env.ESCALATED_CONFORMANCE_TOKEN?.trim();
  const adminToken = process.env.ESCALATED_CONFORMANCE_ADMIN_TOKEN?.trim();
  if (!agentToken) {
    throw new Error('ESCALATED_CONFORMANCE_TOKEN is not set. Set it to an agent token for the install under test.');
  }
  return { baseUrl: base, agentToken, adminToken: adminToken || undefined };
}

export interface ConnectFixture {
  /** A fresh code from the connect page, issued for `verifier` and `redirectUri`. */
  code: string;
  /** A second fresh code for the same verifier and redirect_uri, spent by the failure cases. */
  code2: string;
  verifier: string;
  redirectUri: string;
}

const CONNECT_VARS = [
  'ESCALATED_CONFORMANCE_CONNECT_CODE',
  'ESCALATED_CONFORMANCE_CONNECT_CODE_2',
  'ESCALATED_CONFORMANCE_CONNECT_VERIFIER',
  'ESCALATED_CONFORMANCE_CONNECT_REDIRECT_URI',
] as const;

/** The optional connect fixture, or the names of the variables that are not set. */
export function connectFixture(): { fixture: ConnectFixture } | { missing: string[] } {
  const values = CONNECT_VARS.map((name) => process.env[name]?.trim() ?? '');
  const missing = CONNECT_VARS.filter((_, i) => !values[i]);
  if (missing.length) return { missing };
  const [code, code2, verifier, redirectUri] = values;
  return { fixture: { code, code2, verifier, redirectUri } };
}

/**
 * The optional forbidden-transition fixture, ESCALATED_CONFORMANCE_FORBIDDEN_TRANSITION=from:to,
 * naming a status change this backend refuses. Undefined when unset; throws on a malformed value.
 */
export function forbiddenTransition(statuses: readonly string[]): { from: string; to: string } | undefined {
  const raw = process.env.ESCALATED_CONFORMANCE_FORBIDDEN_TRANSITION?.trim();
  if (!raw) return undefined;
  const [from, to, ...rest] = raw.split(':').map((p) => p.trim());
  if (rest.length || !from || !to || from === to || !statuses.includes(from) || !statuses.includes(to)) {
    throw new Error(
      `ESCALATED_CONFORMANCE_FORBIDDEN_TRANSITION must be "from:to" with two different statuses from ${statuses.join(', ')}; got "${raw}"`,
    );
  }
  return { from, to };
}
