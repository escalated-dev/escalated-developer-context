import { afterAll, beforeAll, expect, it } from 'vitest';
import { api, describeContract, expectSchema, hasFeature } from '../src';

/**
 * Mutates one seeded ticket and puts status, priority and assignee back, even
 * when an assertion fails. Replies and notes cannot be deleted through the API,
 * so they stay on the ticket. About 18 requests per run.
 */
describeContract('ticket actions', () => {
  let reference: string;
  let snap: any; // Ticket as it was before any change
  let agents: any[] = [];
  let macros: any[] = [];
  const tag = `conformance-${Date.now().toString(36)}`;
  let replyId: unknown;
  let noteId: unknown;

  const originalAssignee = () => snap?.assignee?.id ?? null;

  async function restore(): Promise<void> {
    const now = (await api('GET', `/tickets/${reference}`)).json?.data;
    if (!now) return;
    if (now.status !== snap.status) await api('PATCH', `/tickets/${reference}/status`, { body: { status: snap.status } });
    if (now.priority !== snap.priority) await api('PATCH', `/tickets/${reference}/priority`, { body: { priority: snap.priority } });
    if (originalAssignee() !== null && String(now.assignee?.id) !== String(originalAssignee())) {
      await api('POST', `/tickets/${reference}/assign`, { body: { agent_id: originalAssignee() } });
    }
  }

  beforeAll(async () => {
    // Prefer an open ticket that already has an assignee: the API has no way
    // to unassign, so only an assigned ticket can be put back as it was.
    const list = await api('GET', '/tickets', { query: { status: 'open', per_page: 50 } });
    const open: any[] = list.json?.data ?? [];
    const pick = open.find((t) => t.assignee) ?? open[0];
    if (!pick) throw new Error('Seed needs at least one open ticket');
    reference = pick.reference;
    snap = (await api('GET', `/tickets/${reference}`)).json.data;
    agents = (await api('GET', '/agents')).json?.data ?? [];
    if (hasFeature('macros')) macros = (await api('GET', '/macros')).json?.data ?? [];
  });

  afterAll(async () => {
    if (reference && snap) await restore();
  });

  it('reply: 201 with ReplyCreated', async () => {
    const res = await api('POST', `/tickets/${reference}/reply`, { body: { body: `Reply ${tag}` } });
    expect([200, 201]).toContain(res.status);
    expectSchema('ReplyCreated', res.json.data);
    expect(res.json.data.is_internal_note).toBe(false);
    replyId = res.json.data.id;
  });

  it('internal note: is_internal_note is true', async () => {
    const res = await api('POST', `/tickets/${reference}/reply`, {
      body: { body: `Note ${tag}`, is_internal_note: true },
    });
    expect([200, 201]).toContain(res.status);
    expectSchema('ReplyCreated', res.json.data);
    expect(res.json.data.is_internal_note).toBe(true);
    noteId = res.json.data.id;
  });

  it('the reply and the note show in the ticket thread', async () => {
    const res = await api('GET', `/tickets/${reference}`);
    expect(res.status).toBe(200);
    const replies: any[] = res.json.data.replies;
    const reply = replies.find((r) => String(r.id) === String(replyId));
    const note = replies.find((r) => String(r.id) === String(noteId));
    expect(reply, 'reply missing from thread').toBeDefined();
    expect(note, 'note missing from thread').toBeDefined();
    expect(reply.is_internal_note).toBe(false);
    expect(note.is_internal_note).toBe(true);
  });

  it('status waiting_on_customer, then back', async () => {
    const target = snap.status === 'waiting_on_customer' ? 'waiting_on_agent' : 'waiting_on_customer';
    try {
      const res = await api('PATCH', `/tickets/${reference}/status`, { body: { status: target } });
      expect(res.status).toBe(200);
      expect(res.json).toMatchObject({ message: 'Status updated.', status: target });
    } finally {
      const back = await api('PATCH', `/tickets/${reference}/status`, { body: { status: snap.status } });
      expect(back.status).toBe(200);
      expect(back.json.status).toBe(snap.status);
    }
  });

  it('priority changes, then back', async () => {
    const target = snap.priority === 'high' ? 'low' : 'high';
    try {
      const res = await api('PATCH', `/tickets/${reference}/priority`, { body: { priority: target } });
      expect(res.status).toBe(200);
      expect(res.json).toMatchObject({ message: 'Priority updated.', priority: target });
    } finally {
      const back = await api('PATCH', `/tickets/${reference}/priority`, { body: { priority: snap.priority } });
      expect(back.status).toBe(200);
      expect(back.json.priority).toBe(snap.priority);
    }
  });

  it('assign to the other agent, then back', async (ctx) => {
    if (originalAssignee() === null) ctx.skip('no assigned open ticket in the seed, and the API cannot unassign');
    const other = agents.find((a) => String(a.id) !== String(originalAssignee()));
    if (!other) ctx.skip('the seed has only one agent');
    try {
      const res = await api('POST', `/tickets/${reference}/assign`, { body: { agent_id: other.id } });
      expect(res.status).toBe(200);
      expect(res.json).toMatchObject({ message: 'Ticket assigned.' });
    } finally {
      const back = await api('POST', `/tickets/${reference}/assign`, { body: { agent_id: originalAssignee() } });
      expect(back.status).toBe(200);
    }
  });

  it('assign to a non-agent is 422', async () => {
    const res = await api('POST', `/tickets/${reference}/assign`, { body: { agent_id: 2147483000 } });
    expect(res.status).toBe(422);
    expectSchema('ValidationError', res.json);
  });

  it('applies a macro', async (ctx) => {
    if (!hasFeature('tickets.macro')) ctx.skip('backend does not list tickets.macro');
    // Only a macro whose actions this suite can undo (status, priority) or that leave no trace beyond a note.
    const safe = macros.find(
      (m) => m.actions.length > 0 && m.actions.every((a: any) => ['status', 'priority', 'note'].includes(a.type)),
    );
    if (!safe) ctx.skip('no macro in the seed with only status, priority or note actions');
    try {
      const res = await api('POST', `/tickets/${reference}/macro`, { body: { macro_id: safe.id } });
      expect(res.status).toBe(200);
      expect(res.json.message).toContain(safe.name);
    } finally {
      await restore();
    }
  });
});
