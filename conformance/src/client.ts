import { baseUrl as readBaseUrl, env } from './env';

export interface ApiOptions {
  /** Bearer token. Pass `null` to send no Authorization header. Defaults to the agent token. */
  token?: string | null;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

export interface ApiResponse {
  status: number;
  headers: Headers;
  /** Parsed JSON body, or null when the body is empty or not JSON. */
  json: any;
}

const MAX_RETRY_WAIT_MS = 65_000;

export class ConnectionError extends Error {
  constructor(url: string, cause: unknown) {
    const inner = cause instanceof Error ? ((cause.cause as Error | undefined)?.message ?? cause.message) : String(cause);
    super(`Could not connect to ${url}: ${inner}`);
    this.name = 'ConnectionError';
  }
}

export function buildUrl(baseUrl: string, path: string, query?: ApiOptions['query']): string {
  const url = new URL(baseUrl + (path.startsWith('/') ? path : `/${path}`));
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function once(method: string, url: string, token: string | null, body: unknown): Promise<ApiResponse> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
  } catch (e) {
    throw new ConnectionError(url, e);
  }
  const text = await res.text();
  let json: any = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { status: res.status, headers: res.headers, json };
}

/** Call the API under test. Retries once after `Retry-After` on 429. */
export async function api(method: string, path: string, opts: ApiOptions = {}): Promise<ApiResponse> {
  // The token is only required when the call actually uses the default one.
  const token = opts.token === undefined ? env().agentToken : opts.token;
  const url = buildUrl(readBaseUrl(), path, opts.query);
  const m = method.toUpperCase();
  const res = await once(m, url, token, opts.body);
  if (res.status !== 429) return res;
  const seconds = Number(res.headers.get('retry-after') ?? res.json?.retry_after ?? 1);
  const waitMs = Math.min(Math.max(Number.isFinite(seconds) ? seconds : 1, 0) * 1000, MAX_RETRY_WAIT_MS);
  await new Promise((r) => setTimeout(r, waitMs));
  return once(m, url, token, opts.body);
}
