import { describe, expect, inject, it } from 'vitest';
import { api, env, expectSchema } from '../src';

const state = inject('contractState');

describe('GET /meta', () => {
  it('is reachable and served by contract v1', () => {
    if (state.kind !== 'ok') throw new Error(state.message);
    env(); // fails with a clear message when the token variable is missing
  });

  // Everything below needs a live /meta; the first test already reported why it is not.
  // Each test checks the body against the Meta schema first, so a bad body fails
  // with the schema errors and never with a TypeError.
  describe.skipIf(state.kind !== 'ok')('response', () => {
    it('is public, matches Meta, and omits backend_version without a token', async () => {
      const res = await api('GET', '/meta', { token: null });
      expect(res.status).toBe(200);
      expectSchema('Meta', res.json);
      expect(res.json).not.toHaveProperty('backend_version');
    });

    it('matches Meta and includes backend_version with a token', async () => {
      const res = await api('GET', '/meta', { token: env().agentToken });
      expect(res.status).toBe(200);
      expectSchema('Meta', res.json);
      expect(res.json).toHaveProperty('backend_version');
    });

    it('ignores an invalid token: 200 in the public shape, with Vary and Cache-Control', async () => {
      const res = await api('GET', '/meta', { token: 'not-a-real-token-0000000000' });
      expect(res.status).toBe(200);
      expectSchema('Meta', res.json);
      expect(res.json).not.toHaveProperty('backend_version');
      expect(res.headers.get('vary') ?? '', 'Vary header').toMatch(/(^|[\s,])authorization([\s,]|$)|^\*$/i);
      expect(res.headers.get('cache-control') ?? '', 'Cache-Control header').toMatch(/no-store/i);
    });

    it('describes the backend', async () => {
      const res = await api('GET', '/meta', { token: null });
      expectSchema('Meta', res.json);
      const meta = res.json;
      expect(meta.api_version).toMatch(/^1\./);
      expect(meta.backend.length).toBeGreaterThan(0);
      expect(meta.web_url_template).toContain('{reference}');
    });

    it('advertises connect_url exactly when auth.exchange is listed', async () => {
      const res = await api('GET', '/meta', { token: null });
      expectSchema('Meta', res.json);
      const meta = res.json;
      if (meta.features.includes('auth.exchange')) {
        expect(typeof meta.connect_url).toBe('string');
      } else {
        expect(meta.connect_url).toBeNull();
      }
    });
  });
});
