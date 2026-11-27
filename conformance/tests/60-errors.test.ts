import { beforeAll, expect, it } from 'vitest';
import { api, describeContract, expectSchema } from '../src';

describeContract('errors and limits', () => {
  let reference: string;

  beforeAll(async () => {
    const list = await api('GET', '/tickets', { query: { per_page: 1 } });
    reference = list.json?.data?.[0]?.reference;
    if (!reference) throw new Error('Seed needs at least one ticket, but GET /tickets returned none');
  });

  // Expects the agent token to lack the admin ability. A conforming backend
  // refuses before deleting; a broken one deletes the ticket, so run this
  // suite against a throwaway seed only.
  it('an agent token on DELETE /tickets/{reference} is 403, not 401', async () => {
    const res = await api('DELETE', `/tickets/${reference}`);
    expect(res.status).toBe(403);
    expectSchema('Error', res.json);
  });

  it('a validation failure is 422 with an errors map', async () => {
    const res = await api('PATCH', `/tickets/${reference}/status`, { body: {} });
    expect(res.status).toBe(422);
    expectSchema('ValidationError', res.json);
    expect(Object.keys(res.json.errors).length).toBeGreaterThan(0);
  });

  it('a 200 carries X-RateLimit-Limit and X-RateLimit-Remaining', async () => {
    const res = await api('POST', '/auth/validate');
    expect(res.status).toBe(200);
    expect(res.headers.get('x-ratelimit-limit')).toMatch(/^\d+$/);
    expect(res.headers.get('x-ratelimit-remaining')).toMatch(/^\d+$/);
  });
});
