import { BaseSequencer } from 'vitest/node';
import type { TestSpecification } from 'vitest/node';

/**
 * Runs test files in path order. The files share one live install and the
 * action tests mutate a ticket, so the order must not depend on cache or size.
 */
export default class AlphabeticalSequencer extends BaseSequencer {
  async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    return [...files].sort((a, b) => a.moduleId.localeCompare(b.moduleId, 'en'));
  }
}
