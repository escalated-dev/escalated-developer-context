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
