import { afterAll, expect, it } from 'vitest';
import { api, connectFixture, describeContract, expectSchema, hasFeature } from '../src';

/**
 * POST /auth/exchange with codes the backend's CI seeded through the connect
 * flow (see README, "Connect fixture"). The exchange endpoint is limited per IP,
 * not per token, so these requests are counted separately: 4 with the fixture,
 * then up to 11 in the rate limit test, which runs last because it burns the
 * per-IP bucket. This file runs last for the same reason.
 */
describeContract('connect: POST /auth/exchange', () => {
  const found = connectFixture();
  const fixture = 'fixture' in found ? found.fixture : undefined;
  const skipReason = !hasFeature('auth.exchange')
    ? 'backend does not list auth.exchange'
    : fixture
      ? undefined
      : `connect fixture not set (${'missing' in found ? found.missing.join(', ') : ''})`;

  let minted: string | undefined;
  let codeSpent = false;

  const exchange = (code: string, verifier: string, redirectUri: string) =>
    api('POST', '/auth/exchange', {
      token: null,
      retry: false,
      body: { code, code_verifier: verifier, redirect_uri: redirectUri },
    });

  afterAll(async () => {
    // Leave no live token behind. A backend that revoked it on replay answers 401 here.
    if (minted && hasFeature('auth.revoke')) await api('POST', '/auth/revoke', { token: minted });
  });

  it('a fresh code gives an agent token, with Cache-Control: no-store', async (ctx) => {
    if (skipReason || !fixture) return ctx.skip(skipReason);
    const res = await exchange(fixture.code, fixture.verifier, fixture.redirectUri);
    codeSpent = true;
    expect(res.status).toBe(200);
    expectSchema('ExchangeResponse', res.json);
    minted = res.json.token;
    expect(res.headers.get('cache-control') ?? '', 'Cache-Control header').toMatch(/no-store/i);

    const validate = await api('POST', '/auth/validate', { token: minted });
    expect(validate.status).toBe(200);
    expectSchema('AuthValidateResponse', validate.json);
    expect(validate.json.abilities).toEqual(['agent']);
  });

  it('the same code a second time is 400', async (ctx) => {
    if (skipReason || !fixture) return ctx.skip(skipReason);
    if (!codeSpent) await exchange(fixture.code, fixture.verifier, fixture.redirectUri);
    const res = await exchange(fixture.code, fixture.verifier, fixture.redirectUri);
    expect(res.status).toBe(400);
    expectSchema('Error', res.json);
  });

  it('a wrong verifier is 400 and consumes the code', async (ctx) => {
    if (skipReason || !fixture) return ctx.skip(skipReason);
    // Well formed (43 unreserved characters) but not the verifier the code was issued for.
    const wrong = fixture.verifier.startsWith('A') ? 'B'.repeat(43) : 'A'.repeat(43);
    const bad = await exchange(fixture.code2, wrong, fixture.redirectUri);
    const after = await exchange(fixture.code2, fixture.verifier, fixture.redirectUri);

    // Revoke anything a broken backend minted before asserting, so no live token is left behind.
    if (hasFeature('auth.revoke')) {
      for (const res of [bad, after]) {
        if (res.status === 200 && typeof res.json?.token === 'string') {
          await api('POST', '/auth/revoke', { token: res.json.token });
        }
      }
    }

    expect.soft(bad.status, 'a wrong verifier must be refused').toBe(400);
    if (bad.status === 400) expectSchema('Error', bad.json);
    expect.soft(after.status, 'CODE_2 still worked after a failed exchange; any presentation must consume it').toBe(400);
  });

  // Keep this last: it uses up the per-IP exchange limit for the next minute.
  it.skipIf(!hasFeature('auth.exchange'))('11 exchanges within a minute from one client produce a 429', async () => {
    let limited: Awaited<ReturnType<typeof api>> | undefined;
    for (let i = 0; i < 11 && !limited; i++) {
      const res = await exchange(
        `conformance-limit-${i}-${Math.random().toString(36).slice(2)}`,
        'v'.repeat(64),
        `https://${'a'.repeat(32)}.chromiumapp.org/`,
      );
      if (res.status === 429) limited = res;
      else expect(res.status, `exchange ${i + 1} of 11`).toBe(400);
    }
    expect(limited, 'no 429 after 11 exchanges; the contract limits POST /auth/exchange to 10 per minute per IP').toBeDefined();
    expect(limited!.headers.get('retry-after') ?? '', 'Retry-After header').toMatch(/^\d+$/);
  });
});
