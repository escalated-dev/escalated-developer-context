import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  api,
  describeContract,
  disallowedTarget,
  expectSchema,
  hasFeature,
  roundTripTarget,
  statusChainIsRestorable,
} from '../src';

/**
 * Mutates one seeded ticket and puts status, priority and assignee back, even
 * when an assertion fails. Replies and notes cannot be deleted through the API,
 * so they stay on the ticket. Status targets come from the default transition
 * table in the contract. About 22 requests per run, at most 29.
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

  async function current(): Promise<any> {
    return (await api('GET', `/tickets/${reference}`)).json?.data;
  }

  async function restore(): Promise<void> {
    const now = await current();
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
    snap = await current();
    if (!snap) throw new Error(`GET /tickets/${reference} returned no ticket`);
    agents = (await api('GET', '/agents')).json?.data ?? [];
    if (hasFeature('macros')) macros = (await api('GET', '/macros')).json?.data ?? [];
  });

  afterAll(async () => {
    if (reference && snap) await restore();
  });

  it('reply: 201 with ReplyCreated', async () => {
    const res = await api('POST', `/tickets/${reference}/reply`, { body: { body: `Reply ${tag}` } });
    expect(res.status).toBe(201);
    expectSchema('ReplyCreated', res.json.data);
    expect(res.json.data.is_internal_note).toBe(false);
    replyId = res.json.data.id;
  });

  it('internal note: 201 and is_internal_note is true', async () => {
    const res = await api('POST', `/tickets/${reference}/reply`, {
      body: { body: `Note ${tag}`, is_internal_note: true },
    });
    expect(res.status).toBe(201);
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

  it('status changes to an allowed target, then back', async (ctx) => {
    const from: string = (await current())?.status;
    const target = from ? roundTripTarget(from) : undefined;
    if (!target) ctx.skip(`no status the default table allows to and back from "${from}"`);
    try {
      const res = await api('PATCH', `/tickets/${reference}/status`, { body: { status: target } });
      expect(res.status).toBe(200);
      expect(res.json).toMatchObject({ message: 'Status updated.', status: target });
    } finally {
      const back = await api('PATCH', `/tickets/${reference}/status`, { body: { status: from } });
      expect.soft(back.status, 'putting the status back').toBe(200);
      expect.soft(back.json?.status, 'putting the status back').toBe(from);
    }
  });

  it('setting the current status is 200 and a no-op', async () => {
    const res = await api('PATCH', `/tickets/${reference}/status`, { body: { status: snap.status } });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ message: 'Status updated.', status: snap.status });
  });

  it('a transition the table forbids is 422 with errors.status', async (ctx) => {
    const target = disallowedTarget(snap.status);
    if (!target) ctx.skip(`no forbidden status from "${snap.status}" that could be undone`);
    const res = await api('PATCH', `/tickets/${reference}/status`, { body: { status: target } });
    try {
      expect(res.status).toBe(422);
      expectSchema('ValidationError', res.json);
      expect(res.json.errors).toHaveProperty('status');
    } finally {
      if (res.status === 200) await api('PATCH', `/tickets/${reference}/status`, { body: { status: snap.status } });
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
      expect.soft(back.status, 'putting the priority back').toBe(200);
      expect.soft(back.json?.priority, 'putting the priority back').toBe(snap.priority);
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
      expect.soft(back.status, 'putting the assignee back').toBe(200);
    }
  });

  it('assign to a non-agent is 422', async () => {
    const res = await api('POST', `/tickets/${reference}/assign`, { body: { agent_id: 2147483000 } });
    expect(res.status).toBe(422);
    expectSchema('ValidationError', res.json);
  });

  it('applies a macro', async (ctx) => {
    if (!hasFeature('tickets.macro')) ctx.skip('backend does not list tickets.macro');
    const from: string = (await current())?.status ?? snap.status;
    // Only a macro this suite can undo: status and priority actions it can put back,
    // or notes, which leave no trace beyond the note.
    const safe = macros.find(
      (m) =>
        m.actions.length > 0 &&
        m.actions.every((a: any) => ['status', 'priority', 'note'].includes(a.type)) &&
        statusChainIsRestorable(
          from,
          m.actions.filter((a: any) => a.type === 'status').map((a: any) => String(a.value)),
        ),
    );
    if (!safe) {
      ctx.skip(`no macro in the seed with only status, priority or note actions whose status change can be undone from "${from}"`);
    }
    try {
      const res = await api('POST', `/tickets/${reference}/macro`, { body: { macro_id: safe.id } });
      expect(res.status).toBe(200);
      expect(res.json.message).toContain(safe.name);
    } finally {
      await restore();
    }
  });
});
