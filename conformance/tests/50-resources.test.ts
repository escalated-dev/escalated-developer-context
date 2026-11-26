import { expect, it } from 'vitest';
import { api, describeContract, expectSchema, hasFeature } from '../src';

async function expectList(path: string, schema: string): Promise<void> {
  const res = await api('GET', path);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.json.data)).toBe(true);
  expect(res.json).not.toHaveProperty('meta');
  for (const item of res.json.data) expectSchema(schema, item);
}

describeContract('resources', () => {
  it('GET /agents returns {data: Agent[]}', () => expectList('/agents', 'Agent'));

  it('GET /departments returns {data: Department[]}', () => expectList('/departments', 'Department'));

  it.skipIf(!hasFeature('canned_responses'))('GET /canned-responses returns {data: CannedResponse[]}', () =>
    expectList('/canned-responses', 'CannedResponse'),
  );

  it.skipIf(!hasFeature('macros'))('GET /macros returns {data: Macro[]}', () => expectList('/macros', 'Macro'));
});
