import { beforeAll, describe, expect, it } from 'vitest';
import { api, describeContract, expectSchema, hasFeature } from '../src';

describeContract('GET /tickets', () => {
  let base: Awaited<ReturnType<typeof api>>;

  beforeAll(async () => {
    base = await api('GET', '/tickets');
  });

  it('is 200 with {data: TicketListItem[], meta: PaginationMeta}', () => {
    expect(base.status).toBe(200);
    expect(Array.isArray(base.json.data)).toBe(true);
    expect(base.json.data.length).toBeGreaterThanOrEqual(3);
    for (const item of base.json.data) expectSchema('TicketListItem', item);
    expectSchema('PaginationMeta', base.json.meta);
  });

  it('per_page=1&page=2 returns a different reference than page 1', async () => {
    const one = await api('GET', '/tickets', { query: { per_page: 1, page: 1 } });
    const two = await api('GET', '/tickets', { query: { per_page: 1, page: 2 } });
    expect(one.status).toBe(200);
    expect(two.status).toBe(200);
    expect(one.json.data).toHaveLength(1);
    expect(two.json.data).toHaveLength(1);
    expect(two.json.data[0].reference).not.toBe(one.json.data[0].reference);
    expect(two.json.meta.current_page).toBe(2);
    expect(two.json.meta.per_page).toBe(1);
  });

  // The contract says "A per_page above 100 is a 422". The task brief said
  // "caps at 100"; the contract is the source of truth.
  it('per_page=500 is rejected with 422 and field errors', async () => {
    const res = await api('GET', '/tickets', { query: { per_page: 500 } });
    expect(res.status).toBe(422);
    expectSchema('ValidationError', res.json);
  });

  it('status=open returns only open tickets', async () => {
    const res = await api('GET', '/tickets', { query: { status: 'open' } });
    expect(res.status).toBe(200);
    expect(res.json.data.length).toBeGreaterThan(0);
    for (const t of res.json.data) expect(t.status).toBe('open');
  });

  it('unassigned=1 returns only tickets with a null assignee', async () => {
    const res = await api('GET', '/tickets', { query: { unassigned: 1 } });
    expect(res.status).toBe(200);
    expect(res.json.data.length).toBeGreaterThan(0);
    for (const t of res.json.data) expect(t.assignee).toBeNull();
  });

  it.skipIf(!hasFeature('tickets.open_filter'))('open=1 returns only tickets that are neither resolved nor closed', async () => {
    const res = await api('GET', '/tickets', { query: { open: 1 } });
    expect(res.status).toBe(200);
    expect(res.json.data.length).toBeGreaterThan(0);
    for (const t of res.json.data) expect(['resolved', 'closed']).not.toContain(t.status);
  });

  describe.skipIf(!hasFeature('tickets.updated_since'))('updated_since', () => {
    it('a far-future value returns no tickets', async () => {
      const res = await api('GET', '/tickets', { query: { updated_since: '2999-01-01T00:00:00Z' } });
      expect(res.status).toBe(200);
      expect(res.json.data).toEqual([]);
    });

    it('a far-past value returns the seeded tickets', async () => {
      const res = await api('GET', '/tickets', { query: { updated_since: '2000-01-01T00:00:00Z' } });
      expect(res.status).toBe(200);
      expect(res.json.data.length).toBeGreaterThanOrEqual(3);
    });

    it('accepts a +02:00 offset', async () => {
      const res = await api('GET', '/tickets', { query: { updated_since: '2000-01-01T00:00:00+02:00' } });
      expect(res.status).toBe(200);
    });

    it('rejects a malformed value with 422', async () => {
      const res = await api('GET', '/tickets', { query: { updated_since: 'not-a-date' } });
      expect(res.status).toBe(422);
      expectSchema('ValidationError', res.json);
    });
  });

  it.skipIf(!hasFeature('tickets.last_customer_reply_at'))('every item has a last_customer_reply_at key', () => {
    expect(base.json.data.length).toBeGreaterThan(0);
    for (const t of base.json.data) expect(t).toHaveProperty('last_customer_reply_at');
  });
});
