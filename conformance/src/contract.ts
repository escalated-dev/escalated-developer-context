import { describe, inject } from 'vitest';
import './global-setup';

/**
 * Use instead of `describe` in every test file except 00-meta. The block is
 * skipped when the backend does not serve contract v1, so a missing API shows
 * up as one failure in 00-meta rather than a wall of failures.
 */
export function describeContract(name: string, fn: () => void): void {
  describe.skipIf(inject('contractState').kind !== 'ok')(name, fn);
}

/**
 * True when GET /meta lists the feature. Read at collection time, so it works
 * in `it.skipIf(!hasFeature('x'))`. No request is made: /meta is fetched once per run.
 */
export function hasFeature(name: string): boolean {
  const state = inject('contractState');
  return state.kind === 'ok' && state.features.includes(name);
}
