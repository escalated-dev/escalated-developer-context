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
| `ESCALATED_CONFORMANCE_CONNECT_CODE` | no | A fresh connect code. See [Connect fixture](#connect-fixture) |
| `ESCALATED_CONFORMANCE_CONNECT_CODE_2` | no | A second fresh code for the same verifier and `redirect_uri`, spent by the failure cases |
| `ESCALATED_CONFORMANCE_CONNECT_VERIFIER` | no | The `code_verifier` both codes were issued for |
| `ESCALATED_CONFORMANCE_CONNECT_REDIRECT_URI` | no | The `redirect_uri` both codes were issued for |

## Seed the install must have

Each backend's CI provides this before `npm test`:

- Two staff users: the token's owner and one other agent.
- At least three open tickets, at least one unassigned, and at least one open ticket assigned to someone. The action tests change that ticket and put its status, priority and assignee back; the API cannot unassign, so an assigned ticket is needed for the assign test. The replies and notes they add stay on the ticket.
- At least one department.
- Canned responses and macros are optional. The macro test runs only when a macro exists whose actions are all `status`, `priority` or `note`, and whose status changes the suite can undo under the default transition table; otherwise it is skipped with the reason.
- The default status transition table from the contract. The status tests pick their targets from it: a status the ticket can move to and back from, the current status (a no-op), and a status the table forbids.

Run it against a throwaway seed. The suite sends `DELETE /tickets/{reference}` with an agent token and expects 403; a backend that gets that wrong would delete the ticket.

Request counts per run, measured against a mock that serves every feature:

| Bucket | Requests | Limit |
|---|---|---|
| Agent token | 45 (at most about 50 when every restore step fires) | 60 per minute per token |
| Revocable token | 2 | 60 per minute per token |
| Token minted by the connect test | 2 | 60 per minute per token |
| `POST /auth/exchange`, per IP | 11 (1 + 4 + 6 until the 429), at most 16 | 10 per minute per IP |
| Other unauthenticated or invalid-token requests, per IP | 7 (5 with no token, 2 with a garbage token) | the install's per-IP limit |

The exchange limit is per IP, not per token, so its requests are counted on their own. The rate limit test in `70-connect` exists to use that bucket up, which is why it runs last. Wait a minute before running the suite again from the same IP, or the first exchange tests see 429.

### Connect fixture

The connect tests in `70-connect` need two codes that a staff member would get by clicking Approve on the connect page. A suite that only speaks HTTP cannot click, so each backend's CI seeds them before `npm test`:

- Pick one `code_verifier` (43 to 128 characters from `[A-Za-z0-9-._~]`) and one valid `redirect_uri`, for example `https://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.chromiumapp.org/`.
- Issue two codes for the token owner through the backend's own code-issuing path, with the challenge computed from that verifier and that `redirect_uri`. Pass them in as `ESCALATED_CONFORMANCE_CONNECT_CODE` and `ESCALATED_CONFORMANCE_CONNECT_CODE_2`.
- Give them a long TTL, for example an hour, so a slow CI job does not see them expire. Do this in CI only: production keeps the contract's 60-second TTL, and a command or route that issues codes without the connect page must not be reachable outside the test environment.

The tests check that the first code gives a token with abilities `["agent"]` and `Cache-Control: no-store`, that a second use of it is 400, and that the second code is 400 with a wrong verifier and then also 400 with the right one, because a failed exchange still consumes the code. Without the fixture these three tests are skipped with the reason. The rate limit test needs only `auth.exchange` in `GET /meta`.

`npm run typecheck` checks the TypeScript without calling anything.

## What a failure looks like

- URL unreachable: one failure in `00-meta` that names the URL, for example `Could not connect to http://127.0.0.1:9/meta: ...`.
- `GET /meta` answers 404: one failure, `Backend does not serve staff API contract v1 (GET /meta is 404)`. Every other file is skipped.
- `GET /meta` answers anything else that is not a 200 JSON object with a string `api_version`: one failure that says what came back, for example `GET /meta answered 302 (Location: http://127.0.0.1:8787/login); contract v1 says /meta is public and answers 200` or `GET /meta returned non-JSON (text/html): <!doctype html>...`. Every other file is skipped.

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

`api(method, path, { token?, query?, body?, retry? })` returns `{ status, headers, json, text }`.

- `token` defaults to the agent token. Pass `null` to send no Authorization header, or another string to use that token.
- `json` is `null` when the body is empty or not JSON.
- `text` is the raw body.
- A 429 is retried once after waiting `Retry-After` seconds. Pass `retry: false` to get the 429 itself.
- A connection failure throws an error that names the URL.

### Skipping when the contract is absent

`vitest.config.ts` registers `src/global-setup.ts` as a Vitest `globalSetup`. It calls `GET /meta` once per run and shares the result with every test file through `provide('contractState', ...)`. The state is `ok` (a 200 JSON object with a string `api_version`), `missing` (anything else, with a message naming what came back), `unreachable` or `misconfigured`.

- `tests/00-meta.test.ts` reads the state with `inject('contractState')` and reports the failure once, with the right message.
- Every other test file wraps its tests in `describeContract(name, fn)` instead of `describe`. When the state is not `ok`, the block is skipped, so a backend without the API gets one clear failure and not a wall of red.

Files run one at a time, in name order, because they share one live install. `vitest.config.ts` sets `fileParallelism: false` and an alphabetical sequencer (`src/sequencer.ts`), since Vitest's default sequencer does not promise an order. Name new files `NN-topic.test.ts`.

`expectSchema(name, value)` (from `../src`) validates a value against a component of `contracts/staff-api-v1.openapi.yaml` with Ajv and fails with the full error list. `hasFeature(name)` tells whether `GET /meta` lists a feature, for `it.skipIf(!hasFeature('x'))`; it makes no request. `connectFixture()` returns the connect fixture or the names of the variables that are missing. `roundTripTarget`, `disallowedTarget` and `statusChainIsRestorable` read the default transition table.

Assertions in a `finally` block use `expect.soft`, so a failure in the clean-up does not hide the first failure in the test.
