import { beforeAll, expect, it } from 'vitest';
import { api, describeContract, expectSchema } from '../src';

describeContract('GET /tickets/{reference}', () => {
  let reference: string;

  beforeAll(async () => {
    const list = await api('GET', '/tickets', { query: { per_page: 1 } });
    reference = list.json?.data?.[0]?.reference;
    if (!reference) throw new Error('Seed needs at least one ticket, but GET /tickets returned none');
  });

  it('returns a Ticket by reference', async () => {
    const res = await api('GET', `/tickets/${reference}`);
    expect(res.status).toBe(200);
    expectSchema('Ticket', res.json.data);
    expect(res.json.data.reference).toBe(reference);
  });

  it('an unknown reference is 404 with a message', async () => {
    const res = await api('GET', '/tickets/ESC-NOPE-999999');
    expect(res.status).toBe(404);
    expectSchema('Error', res.json);
  });
});
