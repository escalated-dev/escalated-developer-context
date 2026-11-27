import type { TestProject } from 'vitest/node';
import { api } from './client';
import type { ApiResponse } from './client';

export type ContractState =
  | { kind: 'ok'; features: string[] }
  | { kind: 'missing'; message: string }
  | { kind: 'unreachable'; message: string }
  | { kind: 'misconfigured'; message: string };

declare module 'vitest' {
  export interface ProvidedContext {
    contractState: ContractState;
  }
}

export const MISSING_MESSAGE = 'Backend does not serve staff API contract v1 (GET /meta is 404)';

/**
 * Classifies a GET /meta response. Only a 200 whose body is a JSON object with a
 * string api_version counts as the contract being served; anything else is
 * `missing`, with a message that says what came back instead.
 */
export function classifyMeta(res: Pick<ApiResponse, 'status' | 'headers' | 'json' | 'text'>): ContractState {
  if (res.status === 404) return { kind: 'missing', message: MISSING_MESSAGE };
  if (res.status !== 200) {
    const location = res.headers.get('location');
    const where = location ? ` (Location: ${location})` : '';
    return {
      kind: 'missing',
      message: `GET /meta answered ${res.status}${where}; contract v1 says /meta is public and answers 200`,
    };
  }
  const body: unknown = res.json;
  if (body === null && res.text.trim() !== 'null') {
    const type = res.headers.get('content-type') ?? 'no content type';
    const sample = res.text.trim().slice(0, 80).replace(/\s+/g, ' ');
    return {
      kind: 'missing',
      message: `GET /meta returned non-JSON (${type})${sample ? `: ${sample}` : ', empty body'}`,
    };
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { kind: 'missing', message: `GET /meta returned JSON that is not an object: ${res.text.trim().slice(0, 80)}` };
  }
  const meta = body as Record<string, unknown>;
  if (typeof meta.api_version !== 'string') {
    return { kind: 'missing', message: 'GET /meta returned a JSON object without a string api_version' };
  }
  const features = Array.isArray(meta.features) ? meta.features.filter((f): f is string => typeof f === 'string') : [];
  return { kind: 'ok', features };
}

async function probe(): Promise<ContractState> {
  // GET /meta is public, so only the URL is needed here. A missing token is
  // reported by the first test in 00-meta.
  if (!process.env.ESCALATED_CONFORMANCE_URL?.trim()) {
    return { kind: 'misconfigured', message: 'ESCALATED_CONFORMANCE_URL is not set. Set it to the API base, e.g. http://localhost:8000/support/api/v1' };
  }
  try {
    return classifyMeta(await api('GET', '/meta', { token: null }));
  } catch (e) {
    return { kind: 'unreachable', message: (e as Error).message };
  }
}

/** Probes GET /meta once per run and shares the result with every test file. */
export default async function setup(project: TestProject) {
  project.provide('contractState', await probe());
}
