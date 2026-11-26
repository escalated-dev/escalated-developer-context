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
| `ESCALATED_CONFORMANCE_REVOCABLE_TOKEN` | no | A spare agent token. The `POST /auth/revoke` test spends it and checks it is 401 afterwards. Without it that test is skipped |

## Seed the install must have

Each backend's CI provides this before `npm test`:

- Two staff users: the token's owner and one other agent.
- At least three open tickets, at least one unassigned, and at least one open ticket assigned to someone. The action tests change that ticket and put its status, priority and assignee back; the API cannot unassign, so an assigned ticket is needed for the assign test. The replies and notes they add stay on the ticket.
- At least one department.
- Canned responses and macros are optional. The macro test runs only when a macro exists whose actions are all `status`, `priority` or `note`; otherwise it is skipped with the reason.

Run it against a throwaway seed. The suite sends `DELETE /tickets/{reference}` with an agent token and expects 403; a backend that gets that wrong would delete the ticket.

The suite makes about 40 requests with the agent token per run, under the default limit of 60 per minute.

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

Files run one at a time, in name order, because they share one live install. `vitest.config.ts` sets `fileParallelism: false` and an alphabetical sequencer (`src/sequencer.ts`), since Vitest's default sequencer does not promise an order. Name new files `NN-topic.test.ts`.

`expectSchema(name, value)` (from `../src`) validates a value against a component of `contracts/staff-api-v1.openapi.yaml` with Ajv and fails with the full error list. `hasFeature(name)` tells whether `GET /meta` lists a feature, for `it.skipIf(!hasFeature('x'))`; it makes no request.
