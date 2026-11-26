# Staff API conformance suite

A black-box test suite for the staff REST API defined in `contracts/staff-api-v1.md`. Each backend runs it in CI against a live install. The suite knows nothing about the backend's language or framework; it only speaks HTTP.

## Run it

Node 22 or newer.

```bash
cd conformance
npm ci
ESCALATED_CONFORMANCE_URL=http://localhost:8000/support/api/v1 \
ESCALATED_CONFORMANCE_TOKEN=<agent token> \
ESCALATED_CONFORMANCE_ADMIN_TOKEN=<admin token> \
npm test
```

| Variable | Required | Meaning |
|---|---|---|
| `ESCALATED_CONFORMANCE_URL` | yes | Full API base, including the prefix and `/v1` |
| `ESCALATED_CONFORMANCE_TOKEN` | yes | Token with the `agent` ability |
| `ESCALATED_CONFORMANCE_ADMIN_TOKEN` | no | Token with the `admin` ability, for the report routes |

`npm run typecheck` checks the TypeScript without calling anything.

## What a failure looks like

- URL unreachable: one failure in `00-meta` that names the URL, for example `Could not connect to http://127.0.0.1:9/meta: ...`.
- `GET /meta` answers 404: one failure, `Backend does not serve staff API contract v1 (GET /meta is 404)`. Every other file is skipped.

## Writing tests

Test files import only from `../src`:

```ts
import { api, env, describeContract } from '../src';

describeContract('GET /tickets', () => {
  it('requires a token', async () => {
    const res = await api('GET', '/tickets', { token: null });
    expect(res.status).toBe(401);
  });
});
```

`env()` returns `{ baseUrl, agentToken, adminToken? }` and throws a clear message when a variable is missing.

`api(method, path, { token?, query?, body? })` returns `{ status, headers, json }`.

- `token` defaults to the agent token. Pass `null` to send no Authorization header, or another string to use that token.
- `json` is `null` when the body is empty or not JSON.
- A 429 is retried once after waiting `Retry-After` seconds.
- A connection failure throws an error that names the URL.

### Skipping when the contract is absent

`vitest.config.ts` registers `src/global-setup.ts` as a Vitest `globalSetup`. It calls `GET /meta` once per run and shares the result with every test file through `provide('contractState', ...)`. The state is `ok`, `missing` (404), `unreachable` or `misconfigured`.

- `tests/00-meta.test.ts` reads the state with `inject('contractState')` and reports the failure once, with the right message.
- Every other test file wraps its tests in `describeContract(name, fn)` instead of `describe`. When the state is not `ok`, the block is skipped, so a backend without the API gets one clear failure and not a wall of red.

Files run one at a time, in name order, because they share one live install. Name new files `NN-topic.test.ts`.
