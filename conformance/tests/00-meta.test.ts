import { describe, expect, inject, it } from 'vitest';
import { api, env } from '../src';

const state = inject('contractState');

describe('GET /meta', () => {
  it('is reachable and served by contract v1', () => {
    if (state.kind !== 'ok') throw new Error(state.message);
    env(); // fails with a clear message when the token variable is missing
  });

  // Everything below needs a live /meta; the first test already reported why it is not.
  describe.skipIf(state.kind !== 'ok')('response', () => {
    it('is public and omits backend_version without a token', async () => {
      const res = await api('GET', '/meta', { token: null });
      expect(res.status).toBe(200);
      expect(res.json).not.toHaveProperty('backend_version');
    });

    it('includes backend_version with a token', async () => {
      const res = await api('GET', '/meta', { token: env().agentToken });
      expect(res.status).toBe(200);
      expect(res.json).toHaveProperty('backend_version');
    });

    it('describes the backend', async () => {
      const res = await api('GET', '/meta', { token: null });
      const meta = res.json;
      expect(meta.api_version).toMatch(/^1\./);
      expect(typeof meta.backend).toBe('string');
      expect(meta.backend.length).toBeGreaterThan(0);
      expect(Array.isArray(meta.features)).toBe(true);
      for (const f of meta.features) expect(typeof f).toBe('string');
      expect(meta.web_url_template).toContain('{reference}');
    });

    it('advertises connect_url exactly when auth.exchange is listed', async () => {
      const { json: meta } = await api('GET', '/meta', { token: null });
      if (meta.features.includes('auth.exchange')) {
        expect(typeof meta.connect_url).toBe('string');
      } else {
        expect(meta.connect_url).toBeNull();
      }
    });
  });
});
