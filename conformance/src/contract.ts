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
