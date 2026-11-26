import type { TestProject } from 'vitest/node';
import { api } from './client';

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

async function probe(): Promise<ContractState> {
  // GET /meta is public, so only the URL is needed here. A missing token is
  // reported by the first test in 00-meta.
  if (!process.env.ESCALATED_CONFORMANCE_URL?.trim()) {
    return { kind: 'misconfigured', message: 'ESCALATED_CONFORMANCE_URL is not set. Set it to the API base, e.g. http://localhost:8000/support/api/v1' };
  }
  try {
    const res = await api('GET', '/meta', { token: null });
    if (res.status === 404) return { kind: 'missing', message: MISSING_MESSAGE };
    const features: unknown = res.json?.features;
    return { kind: 'ok', features: Array.isArray(features) ? features.filter((f): f is string => typeof f === 'string') : [] };
  } catch (e) {
    return { kind: 'unreachable', message: (e as Error).message };
  }
}

/** Probes GET /meta once per run and shares the result with every test file. */
export default async function setup(project: TestProject) {
  project.provide('contractState', await probe());
}
