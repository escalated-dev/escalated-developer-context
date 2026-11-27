import { expect, it } from 'vitest';
import { api, describeContract, expectSchema, hasFeature } from '../src';

const revocable = process.env.ESCALATED_CONFORMANCE_REVOCABLE_TOKEN?.trim();

describeContract('auth', () => {
  it('POST /auth/validate returns the caller', async () => {
    const res = await api('POST', '/auth/validate');
    expect(res.status).toBe(200);
    expectSchema('AuthValidateResponse', res.json);
    expect(res.json.is_agent).toBe(true);
  });

  it('rejects a request with no token: 401 with a message', async () => {
    const res = await api('POST', '/auth/validate', { token: null });
    expect(res.status).toBe(401);
    expectSchema('Error', res.json);
  });

  it('rejects a garbage token: 401 with a message', async () => {
    const res = await api('POST', '/auth/validate', { token: 'not-a-real-token-0000000000' });
    expect(res.status).toBe(401);
    expectSchema('Error', res.json);
  });

  it.skipIf(!hasFeature('auth.exchange'))('POST /auth/exchange with a random code is 400 with a message', async () => {
    const res = await api('POST', '/auth/exchange', {
      token: null,
      body: {
        code: `conformance-${Math.random().toString(36).slice(2)}`,
        code_verifier: 'v'.repeat(64),
        redirect_uri: `https://${'a'.repeat(32)}.chromiumapp.org/`,
      },
    });
    expect(res.status).toBe(400);
    expectSchema('Error', res.json);
  });

  it.skipIf(!revocable)('POST /auth/revoke is 204 and the token is 401 afterwards', async () => {
    const revoke = await api('POST', '/auth/revoke', { token: revocable });
    expect(revoke.status).toBe(204);
    const after = await api('POST', '/auth/validate', { token: revocable });
    expect(after.status).toBe(401);
  });
});
