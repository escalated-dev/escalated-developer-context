# Staff API contract v1

The REST API that every Escalated backend serves to staff clients, such as the browser extension. It is derived from `escalated-laravel` 1.9.20 (`routes/api.php`) with the new endpoints and fixes listed in the [change log](#change-log). If a backend disagrees with this file, this file is right.

Contract version: `1.0`.

The words MUST, MUST NOT, SHOULD, SHOULD NOT and MAY are used as in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

A conformance suite runs against a live backend over HTTP. This document is its source, together with the OpenAPI file that sits beside it.

## Scope

In scope: the staff API. That means agent and admin calls made with a Bearer token.

Out of scope:

- The customer mobile API (`support/api/v1/mobile`). It is a different surface with different tokens.
- Inertia pages and session routes. The one exception is the connect page in [Connecting an extension](#connecting-an-extension), which is a browser page.
- Webhooks and host callbacks.

Backends add to this API without removing their existing routes. Old paths stay as aliases, so current clients keep working.

## Base path and discovery

Every path in this document is relative to the API prefix.

| Backend | Default prefix |
|---|---|
| All except WordPress | `support/api/v1` |
| WordPress | `/wp-json/escalated/v1` |

An install may change the prefix in config. Clients find the API with `GET {prefix}/meta`. It needs no token. A client tries the default prefix first, then each backend's known prefix, and lets the user type a custom one.

The API is off by default on most backends. When it is off, every route in this document answers 404.

## Authentication

Send `Authorization: Bearer <token>` on every request except `GET /meta` and `POST /auth/exchange`. Tokens are opaque strings. The server stores only a hash.

A token has a list of abilities: `agent`, `admin`, or `*`. They are not hierarchical. `*` passes every check. A call to an `admin` route needs the `admin` ability, and the token's owner must be an admin. A call to an `agent` route needs the `agent` ability, and the owner must still be an agent when the call is made.

| Status | Body `message` | When |
|---|---|---|
| 401 | `Unauthenticated.` | No Bearer header |
| 401 | `Invalid token.` | Unknown token |
| 401 | `Token has expired.` | Past `expires_at` |
| 401 | `Token owner not found.` | The user was deleted |
| 403 | `Insufficient permissions.` | Token lacks the ability, or owner is not an admin |
| 403 | `User no longer has agent access.` | Owner lost staff access |

Clients match on the status, not on the message text.

Tokens come from two places. An admin can create one in the admin UI. A browser extension gets one through the connect flow below.

### Connecting an extension

The connect flow uses a browser redirect with PKCE (S256, [RFC 7636](https://www.rfc-editor.org/rfc/rfc7636)). The extension never sees the staff member's password.

1. The extension generates a random `code_verifier`, derives `code_challenge` from it as described in [PKCE encoding](#pkce-encoding), and generates a random `state`.
2. The extension opens this page in the browser, where the staff member is signed in:

   `GET {web_prefix}/agent/connect-extension?redirect_uri=&state=&code_challenge=&code_challenge_method=S256&client_name=`

   `{web_prefix}` is the install's web route prefix, `support` by default. The page URL is advertised as `connect_url` in `GET /meta`.
3. The page checks the parameters as described in [Connect page requirements](#connect-page-requirements). The Chrome extension redirect is `https://<extension id>.chromiumapp.org/`.
4. The page shows who is asking (the extension ID and `client_name`) and two buttons.
   - Approve creates a one-time code and redirects to `redirect_uri?code=<code>&state=<state>`.
   - Deny redirects to `redirect_uri?error=access_denied&state=<state>`.
5. The code lives 60 seconds and works once. The server stores a hash of it, with the challenge, the `redirect_uri`, the extension ID and the staff member who approved it.
6. The extension calls `POST /auth/exchange` with the code, the verifier and the same `redirect_uri`, and gets a token. The server follows the [Exchange rules](#exchange-rules).

The token minted by the exchange has:

- abilities `["agent"]`
- name `Browser extension (<client_name>)`, using the truncated `client_name`, or `Browser extension` when `client_name` was empty or missing
- kind `browser_extension`
- the extension ID from the code
- no expiry, unless the install sets one

Each staff member sees and revokes their own extension tokens at `{web_prefix}/agent/browser-extensions`, which shows each token's name, extension ID and creation time. Extension tokens also appear on the admin API tokens page, with their kind shown, so an admin can revoke them. A client can also revoke its own token with `POST /auth/revoke`.

#### Connect page requirements

Checking `redirect_uri`:

- The page MUST check `redirect_uri` before anything else. When it is missing or invalid, the page MUST show an error page and MUST NOT redirect anywhere, not even with an error.
- A valid Chrome `redirect_uri` matches `^https://[a-p]{32}\.chromiumapp\.org/$` as a whole string. The check MUST be a full-string match. Common anchoring mistakes let `https://<32 letters>.chromiumapp.org/\n` or a longer string through:
  - In Ruby, `^` and `$` are line anchors. Use `\A` and `\z`.
  - In PHP (PCRE without the `D` modifier), Python `re.match`, and Elixir, `$` also matches before a trailing newline. Use `\z` (or the `D` modifier in PHP), Python `re.fullmatch`, or `\z` in Elixir.
  - In Java, use `Pattern.matcher(...).matches()`, not `find()`.
- A parse-based check is an accepted equivalent. It MUST require all of: scheme `https`; a host that matches the pattern exactly (32 letters `a` to `p`, then `.chromiumapp.org`); no port; no userinfo; path exactly `/`; no query; no fragment. The check MUST run on the raw string as well as the parsed parts, so a value that parsers normalise (trailing whitespace, a newline, upper-case letters) is refused.
- An install MAY add its own patterns, for example for another browser. Every added pattern MUST be held to the same full-string rule.

Checking the other parameters, once `redirect_uri` is valid:

- When `state` is missing, `code_challenge` is missing or is not exactly 43 characters from `[A-Za-z0-9_-]`, or `code_challenge_method` is missing or anything other than `S256`, the page MUST redirect to `redirect_uri?error=invalid_request&state=<state>`. It leaves out `state` when none was sent. It MUST NOT issue a code.
- `client_name` is optional display text. The page MUST truncate it to 64 characters and MUST HTML-escape it on output. The token name uses the truncated value.

Who can approve:

- Only a signed-in staff member with agent access can approve. A signed-in user without agent access MUST get a 403 page, with no redirect.
- A signed-out user MUST be sent to sign in and then returned to the connect page with every query parameter intact.

How the page behaves:

- `GET` MUST NOT have side effects. It only shows the page.
- Approve and Deny MUST be `POST` requests that carry the session's CSRF token. A `POST` without a valid CSRF token MUST be refused without a redirect.
- The page MUST NOT auto-approve, even for an extension the staff member approved before. Every code needs a fresh click on Approve, so a non-interactive `chrome.identity.launchWebAuthFlow` call never gets a code.
- Every response from the page, including the error page, MUST carry `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`.
- The page MUST show the extension ID, taken from the `redirect_uri` host (the 32 letters before `.chromiumapp.org`), and not only `client_name`. The caller chooses `client_name`, so it proves nothing. The ID is stored with the code and then with the token, so the browser extensions page can show it.

#### PKCE encoding

- `code_verifier` is 43 to 128 characters from `[A-Za-z0-9-._~]`.
- `code_challenge = BASE64URL(SHA-256(ASCII(code_verifier)))` with the `=` padding removed. It is always 43 characters.
- The default URL-safe Base64 encoders in Ruby (`Base64.urlsafe_encode64`), Python (`base64.urlsafe_b64encode`) and Java (`Base64.getUrlEncoder()`) add `=` padding. Strip it, or use `padding: false` in Ruby and `.withoutPadding()` in Java. A padded challenge never matches.
- Test vector from RFC 7636 Appendix B: the verifier `dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk` gives the challenge `E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM`. Each backend SHOULD have a unit test with it.

#### Exchange rules

- The server MUST compare the `redirect_uri` sent to `POST /auth/exchange` with the one stored for the code by exact string equality, with no normalisation.
- The server MUST compute the challenge from `code_verifier` as in [PKCE encoding](#pkce-encoding) and compare it with the stored challenge. It SHOULD use a constant-time comparison.
- Consuming a code MUST be atomic: two concurrent exchanges of one code MUST NOT both succeed. A conditional update that marks the code used only when it is still unused, followed by a check of the affected row count, is enough. A read followed by a separate write is not.
- Any presentation of a known code MUST consume it, even when the exchange then fails because the verifier or the `redirect_uri` is wrong. A wrong guess burns the code.
- Codes MUST carry at least 128 bits of entropy, for example 32 random bytes encoded as base64url, and MUST be stored hashed.
- A code expires 60 seconds after it is issued.
- The 200 response MUST carry `Cache-Control: no-store`.
- When an already used code is presented again, the server SHOULD revoke the token that code issued, since a replay means the code leaked. The server keeps the used code's record, with the id of the token it issued, at least until the code would have expired.
- A body that is missing `code`, `code_verifier` or `redirect_uri`, or where one of them is not a string, is a 422 validation error. That check runs before any code lookup, so it does not consume a code.
- Every failure that involves a code (unknown, used, expired, wrong verifier, mismatched `redirect_uri`) answers the single generic 400 described in [POST /auth/exchange](#post-authexchange). The response never says which.

## Conventions

### Format

- Bodies are JSON. Send `Content-Type: application/json` and `Accept: application/json`.
- Every timestamp is ISO 8601 in UTC, for example `2026-11-26T14:03:09Z`. A `+00:00` suffix is accepted in place of `Z`. Clients must parse both.
- Enums are lower-case strings. Never integers.
- Tickets in paths are addressed by `reference` (for example `ESC-00042`), not by numeric id.
- Ids in bodies and responses may be integers or strings, because host apps use either. Clients treat them as opaque.

### Enums

| Field | Values |
|---|---|
| `status` | `open`, `in_progress`, `waiting_on_customer`, `waiting_on_agent`, `escalated`, `resolved`, `closed`, `reopened`, `live` |
| `priority` | `low`, `medium`, `high`, `urgent`, `critical` |
| `ticket_type` | `question`, `problem`, `incident`, `task` |

A backend emits `ticket_type` as `question` when the stored value is null.

### Empty objects

Some backends serialize an empty JSON object as `[]`. Clients must accept `[]` as empty for free-form object fields such as ticket `metadata` and report `filters`.

### Pagination

`GET /tickets` takes `page` (default 1) and `per_page` (default 15, maximum 100). A `per_page` above 100 is a 422. It answers:

```json
{
  "data": [],
  "meta": { "current_page": 1, "last_page": 1, "per_page": 15, "total": 0 }
}
```

The other list endpoints (`/agents`, `/departments`, `/tags`, `/canned-responses`, `/macros`) return `{ "data": [] }` with no `meta`.

### Errors

Every error body has a `message`. A validation error also has `errors`, a map from field name to a list of strings.

```json
{ "message": "The status field is required.", "errors": { "status": ["The status field is required."] } }
```

| Status | Meaning |
|---|---|
| 400 | Bad request. Used by `POST /auth/exchange` |
| 401 | Missing, unknown or expired token |
| 403 | Token or user lacks permission. Also a policy refusal (`This action is unauthorized.`) |
| 404 | Unknown ticket, action, report type or route |
| 422 | Validation failed |
| 429 | Rate limited |

### Rate limits

The default is 60 requests per minute per token. Install config may change it. Unauthenticated routes are limited per IP. Requests that fail authentication (401) SHOULD also be limited per IP, so that guessing tokens is no faster than the per-IP limit allows.

Every response from a limited route carries:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`

When the limit is hit the answer is 429 with `Retry-After` (seconds), `X-RateLimit-Remaining: 0` and this body:

```json
{ "message": "Too many requests.", "retry_after": 30 }
```

### CORS

The API sends no CORS headers. Browser extensions call it from a service worker or an extension page with host permission, never from a content script.

## Shared shapes

### Ticket list item

Returned by `GET /tickets`.

| Field | Type | Notes |
|---|---|---|
| `id` | id | |
| `reference` | string | |
| `ticket_type` | string | |
| `account` | `{type, id}` or null | Present only when accounts are enabled |
| `subject` | string | |
| `status`, `status_label` | string | |
| `priority`, `priority_label` | string | |
| `requester` | `{name, email}` | |
| `assignee` | `{id, name}` or null | |
| `department` | `{id, name}` or null | |
| `sla_breached` | boolean | |
| `last_reply_at` | timestamp or null | Last reply of any kind |
| `last_customer_reply_at` | timestamp or null | Last public activity from the customer side. New in v1 |
| `created_at`, `updated_at` | timestamp | |

### Ticket

Returned by `GET /tickets/{reference}` and `POST /tickets`. It has every list item field except `requester`, plus:

| Field | Type | Notes |
|---|---|---|
| `description` | string | |
| `channel` | string | |
| `metadata` | object or null | |
| `external_reference` | string or null | |
| `requester` | `{kind, id, name, email}` | `kind` is `user`, `contact` or `guest` |
| `assignee` | `{id, name, email}` or null | |
| `tags` | `[{id, name, color}]` | |
| `subjects` | `[Subject]` | Only where subjects are supported |
| `replies` | `[Reply]` | Latest first |
| `activities` | `[{id, type, description, causer, created_at}]` | The latest 20. `causer` is `{id, name}` or null |
| `sla` | object | `first_response_due_at` (timestamp or null), `first_response_at` (timestamp or null), `first_response_breached` (boolean), `resolution_due_at` (timestamp or null), `resolution_breached` (boolean) |
| `is_following` | boolean | True when the caller follows the ticket |
| `followers_count` | integer | |
| `custom_actions` | array | `{key, label, url, method, ...}`, for the caller |
| `resolved_at`, `closed_at` | timestamp or null | |

`POST /tickets` returns the ticket without `replies` and `activities`.

### Reply

`{id, body, is_internal_note, is_pinned, author, attachments, created_at}`. `author` is `{id, name, email}` or null. `attachments` is `[{id, filename, mime_type, size, url}]`.

### Subject

`{link_id, type, id, role, position, title, subtitle, url, color, icon, missing}`. `missing` is true when the linked record is gone or the caller may not see it.

## Endpoints

Ability `none` means no token. The last column says whether the browser extension needs the endpoint on every backend.

| Method | Path | Ability | Request | Response | Extension |
|---|---|---|---|---|---|
| GET | `/meta` | none | | `{api_version, backend, features, connect_url, web_url_template}`, plus `backend_version` with a valid token | yes |
| POST | `/auth/exchange` | none | `{code, code_verifier, redirect_uri}` | `{token, token_type, expires_at, user}` | yes |
| POST | `/auth/revoke` | any valid token | | 204, no body | yes |
| POST | `/auth/validate` | agent | | `{user, abilities, is_agent, is_admin, token_name, expires_at}` | yes |
| GET | `/dashboard` | agent | | `{stats, recent_tickets, needs_attention, my_performance}` | yes |
| GET | `/tickets` | agent | query filters below | `{data: [Ticket list item], meta}` | yes |
| POST | `/tickets` | agent | create fields below | 201 `{data: Ticket, message}` | yes |
| GET | `/tickets/{reference}` | agent | | `{data: Ticket}` | yes |
| DELETE | `/tickets/{reference}` | admin | | `{message}` | no |
| GET | `/tickets/{reference}/subjects` | agent | | `{data: [Subject]}` | no |
| PUT | `/tickets/{reference}/subjects` | agent | `{subjects: [{type, id, role?}]}` | `{data: [Subject]}` | no |
| POST | `/tickets/{reference}/reply` | agent | `{body, is_internal_note?}` | 201 `{data: Reply created, message}` | yes |
| PATCH | `/tickets/{reference}/status` | agent | `{status}` | `{message, status}` | yes |
| PATCH | `/tickets/{reference}/priority` | agent | `{priority}` | `{message, priority}` | yes |
| POST | `/tickets/{reference}/assign` | agent | `{agent_id}` | `{message}` | yes |
| POST | `/tickets/{reference}/follow` | agent | | `{message, following}` | no |
| POST | `/tickets/{reference}/macro` | agent | `{macro_id}` | `{message}` | yes |
| POST | `/tickets/{reference}/actions/{action}` | agent | `{payload?}` | `{message, action}` | no |
| POST | `/tickets/{reference}/tags` | agent | `{tag_ids}` | `{message}` | no |
| GET | `/agents` | agent | | `{data: [{id, name, email}]}` | yes |
| GET | `/departments` | agent | | `{data: [{id, name, description, is_active}]}` | yes |
| GET | `/tags` | agent | | `{data: [{id, name, color}]}` | no |
| GET | `/canned-responses` | agent | | `{data: [{id, title, body}]}` | yes |
| GET | `/macros` | agent | | `{data: [{id, name, actions, order}]}` | yes |
| GET | `/realtime/config` | agent | | config object, or `null` | no |
| GET | `/reports/summary` | admin | `period` | summary object | no |
| GET | `/reports/export/{type}` | admin | `format`, `period` | JSON or CSV | no |

### GET /meta

No token needed. Rate limited per IP. This is how a client finds the API before sign-in.

An unknown or expired token is ignored: the answer is the public 200 response, never 401. Every response MUST carry `Vary: Authorization` and `Cache-Control: no-store`, because the body depends on the token.

```json
{
  "api_version": "1.0",
  "backend": "laravel",
  "features": ["tickets.create", "tickets.macro", "tickets.updated_since", "tickets.last_customer_reply_at", "tickets.open_filter", "canned_responses", "macros", "auth.exchange", "auth.revoke", "realtime"],
  "connect_url": "https://help.example.com/support/agent/connect-extension",
  "web_url_template": "https://help.example.com/support/agent/tickets/{reference}"
}
```

The `connect_url` and `web_url_template` values are illustrative examples. Real values follow the install's host and web prefix.

- `backend` is one of `laravel`, `rails`, `django`, `adonis`, `symfony`, `wordpress`, `phoenix`, `go`, `dotnet`, `spring`, `nestjs`.
- `connect_url` is the absolute URL of the connect page. It is `null` when `auth.exchange` is off.
- `web_url_template` is the absolute agent ticket URL with `{reference}` where the reference goes.
- `connect_url` and `web_url_template` MUST be on the same origin (scheme, host and port) as the API base. A client SHOULD refuse a `/meta` response that points elsewhere, since following it would send the staff member to another site.
- With a valid token the response also has `backend_version`, for example `"1.9.21"`. It is left out of the public response so installs do not advertise their version.

### POST /auth/exchange

No token. Rate limited to 10 per minute per IP. The server follows the [Exchange rules](#exchange-rules).

Request: `{code, code_verifier, redirect_uri}`, all strings.

Success, 200, with `Cache-Control: no-store`:

```json
{
  "token": "<token>",
  "token_type": "Bearer",
  "expires_at": null,
  "user": { "id": 7, "name": "Sam Agent", "email": "sam@example.com" }
}
```

`expires_at` is a timestamp, or `null` when the token never expires.

Failure, 400 `{ "message": "Invalid or expired code." }`. The same message covers an unknown code, a used code, an expired code, a wrong verifier and a `redirect_uri` that does not match. The response never says which. A body with a missing or non-string field is a 422, checked before any code lookup.

### POST /auth/revoke

Any valid token, whatever its abilities. Deletes the token that made the call. Answers 204 with no body. The token is dead on the next request.

### POST /auth/validate

Returns the caller:

```json
{
  "user": { "id": 7, "name": "Sam Agent", "email": "sam@example.com" },
  "abilities": ["agent"],
  "is_agent": true,
  "is_admin": false,
  "token_name": "Browser extension (Chrome)",
  "expires_at": null
}
```

### GET /dashboard

```json
{
  "stats": { "open": 0, "my_assigned": 0, "unassigned": 0, "sla_breached": 0, "resolved_today": 0 },
  "recent_tickets": [
    { "id": 1, "reference": "ESC-00001", "subject": "", "status": "open", "priority": "medium",
      "requester_name": "", "assignee_name": null, "created_at": "" }
  ],
  "needs_attention": {
    "sla_breaching": [{ "reference": "", "subject": "", "priority": "", "requester_name": "" }],
    "unassigned_urgent": [{ "reference": "", "subject": "", "priority": "", "requester_name": "" }]
  },
  "my_performance": { "resolved_this_week": 0 }
}
```

`recent_tickets` has the 10 newest tickets. Each `needs_attention` list has at most 5 items. `unassigned_urgent` holds open, unassigned tickets with priority `urgent` or `critical`.

### GET /tickets

Query parameters. All are optional.

| Parameter | Meaning |
|---|---|
| `status` | One status value |
| `priority` | One priority value |
| `ticket_type` | One ticket type |
| `assigned_to` | Assignee id |
| `unassigned` | `1` for tickets with no assignee |
| `open` | `1` for tickets in any open-family status: every status except `resolved` and `closed`. `0` is the same as leaving it out. Combines with the other filters, so `open=1&status=resolved` returns nothing. Listed as `tickets.open_filter` in `/meta` features |
| `department_id` | Department id |
| `account_type`, `account_id` | Account filter. Must be sent together |
| `search` | Matches subject, reference, description, and the requester's name and email |
| `sla_breached` | `1` for tickets with a breached SLA |
| `tag_ids[]` | Tag ids |
| `following` | `1` for tickets the caller follows. `0` is the same as leaving it out |
| `updated_since` | ISO 8601 timestamp. Tickets with `updated_at >= updated_since`. A malformed value is a 422 |
| `sort_by` | One of `created_at` (default), `updated_at`, `status`, `priority`, `subject`, `reference`, `assigned_to`, `department_id`, `resolved_at`, `closed_at`. Anything else falls back to `created_at` |
| `sort_dir` | `asc` or `desc` (default) |
| `page`, `per_page` | See [Pagination](#pagination) |

Ties in the sort column are broken by `id`, in the same direction as `sort_dir`, so pages do not overlap or skip tickets.

### POST /tickets

| Field | Type | Rules |
|---|---|---|
| `subject` | string | Required, 255 characters at most |
| `description` | string | Required, 65535 characters at most |
| `priority` | string | A priority value. Default is the install's default priority, `medium` unless changed |
| `ticket_type` | string | A ticket type. Default `question` |
| `department_id` | id or null | Must exist |
| `tags` | array of tag ids | Each must exist |
| `external_reference` | string or null | 255 characters at most |
| `metadata` | object or null | JSON, 16384 bytes at most by default |
| `requester` | object | Either `{id}` for an existing user, or `{name, email}`. Default is the caller |
| `subjects` | array | `[{type, id, role?}]` |

Answers 201 `{data: Ticket, message: "Ticket created."}`. The ticket starts as `open`, with channel `web`.

### POST /tickets/{reference}/reply

`body` is required (65535 characters at most). `is_internal_note` is optional and defaults to false. A note is private to staff.

Answers 201 with a reduced reply, not the full [Reply](#reply) shape. It has no `is_pinned`, `attachments` or author `email`:

```json
{
  "data": { "id": 1, "body": "", "is_internal_note": false, "author": { "id": 7, "name": "Sam Agent" }, "created_at": "" },
  "message": "Reply sent."
}
```

The message is `Note added.` for a note.

### Status, priority, assign

- `PATCH /tickets/{reference}/status` takes `{status}` and answers `{message: "Status updated.", status}`. See [Status transitions](#status-transitions).
- `PATCH /tickets/{reference}/priority` takes `{priority}` and answers `{message: "Priority updated.", priority}`.
- `POST /tickets/{reference}/assign` takes `{agent_id}` and answers `{message: "Ticket assigned."}`. An unknown agent is a 422.

### Status transitions

A backend MAY restrict which status changes it allows. Backends differ here: some allow any change, some hard-code a table, and Laravel reads its table from install config.

- A change the backend refuses MUST be a 422 with `errors.status`, never a 500. For example `{"message": "Cannot change status from closed to waiting_on_customer.", "errors": {"status": ["Cannot change status from closed to waiting_on_customer."]}}`.
- Setting the status a ticket already has MUST be a 200 and a no-op.

Clients cannot know the table in advance, so they treat a 422 with `errors.status` as "not allowed from here" and show the message.

Recommended default table. This is informative, not normative; it is Laravel's default config:

| From | Allowed to |
|---|---|
| `open` | `in_progress`, `waiting_on_customer`, `waiting_on_agent`, `escalated`, `resolved`, `closed` |
| `in_progress` | `waiting_on_customer`, `waiting_on_agent`, `escalated`, `resolved`, `closed` |
| `waiting_on_customer` | `open`, `in_progress`, `resolved`, `closed` |
| `waiting_on_agent` | `open`, `in_progress`, `escalated`, `resolved`, `closed` |
| `escalated` | `in_progress`, `resolved`, `closed` |
| `resolved` | `reopened`, `closed` |
| `closed` | `reopened` |
| `reopened` | `in_progress`, `waiting_on_customer`, `waiting_on_agent`, `escalated`, `resolved`, `closed` |
| `live` | `open`, `resolved`, `closed` |

### POST /tickets/{reference}/follow

Toggles. Answers `{message, following}` where `following` is the new state. The message is `Following ticket.` when the caller now follows, and `Unfollowed ticket.` when they stopped.

### POST /tickets/{reference}/macro

Takes `{macro_id}`, the macro `id` as returned by `GET /macros`, as an integer. The macro must be shared or created by the caller, or the answer is 404. Applies the macro's actions in order. Answers `{message: "Macro \"<name>\" applied."}`.

### POST /tickets/{reference}/actions/{action}

Triggers a custom action by key. `payload` is an optional object. An unknown or hidden action is 404. A disabled action is 403. Answers `{message, action}`.

### POST /tickets/{reference}/tags

`tag_ids` is required: an array of integer tag ids. Each must exist. A backend casts them to integers. It replaces the full tag set: tags not in the list are removed. Answers `{message: "Tags updated."}`.

### GET /macros

```json
{ "data": [{ "id": 1, "name": "Close as solved", "actions": [{ "type": "status", "value": "resolved" }], "order": 0 }] }
```

`actions` is an ordered list of `{type, value}`. `type` is one of `status`, `priority`, `assign`, `tags`, `department`, `reply`, `note`. Only shared macros and the caller's own are listed, sorted by `order`.

### GET /realtime/config

When the install broadcasts over Reverb or Pusher:

```json
{ "driver": "reverb", "channel_prefix": "", "key": "", "host": "", "port": 8080, "scheme": "https", "cluster": null }
```

Otherwise the body is `null`.

### Subjects

`PUT /tickets/{reference}/subjects` replaces the full set. The `subjects` key must be present, and can be an empty list. Where subjects are not supported the answer is 404.

### Reports

- `GET /reports/summary` takes `period` in days (default 30) and answers `{period_days, avg_first_response_hours, avg_resolution_hours, sla_compliance_rate, csat_average, volume, by_status, by_priority, comparison}`. `by_status` and `by_priority` are lists of `{label, value}` rows, for example `[{"label": "open", "value": 12}]`, not maps. A backend casts each `value` to an integer, since some database drivers return counts as strings.
- `GET /reports/export/{type}` takes `format` (`json` default, or `csv`) and `period`. `type` is one of `tickets`, `agent_performance`, `sla_compliance`, `csat`, `resolution_times`, `first_response_times`. Any other type is 404. JSON answers `{report_type, generated_at, filters, record_count, data}`. An empty `filters` may arrive as `[]`.

## Features

`GET /meta` lists the features a backend serves. A client hides what is missing.

| Feature | Means |
|---|---|
| `tickets.create` | `POST /tickets` works |
| `tickets.macro` | `POST /tickets/{reference}/macro` works |
| `tickets.updated_since` | `GET /tickets` honours `updated_since` |
| `tickets.last_customer_reply_at` | List and show items carry `last_customer_reply_at` |
| `tickets.open_filter` | `GET /tickets` honours `open` |
| `canned_responses` | `GET /canned-responses` works |
| `macros` | `GET /macros` works |
| `auth.exchange` | The connect page and `POST /auth/exchange` work |
| `auth.revoke` | `POST /auth/revoke` works |
| `realtime` | `GET /realtime/config` can return a config |

A backend that passes the conformance suite lists all of them. The list exists so a backend that is partway there can say so honestly.

## Change log

### 1.0

First version. Taken from `escalated-laravel` 1.9.20 with these changes to Laravel's behaviour:

- Added `GET /meta`, `POST /auth/exchange`, `POST /auth/revoke` and the connect flow.
- Added `updated_since` on `GET /tickets`.
- Added `last_customer_reply_at` on ticket list and show items.
- Added the optional `open` filter on `GET /tickets` (`open=1` returns every status except `resolved` and `closed`), listed as the `tickets.open_filter` feature.
- `GET /macros` returns `actions`. Laravel returned `steps`, which was always null.
- `GET /reports/export/{type}` answers 404 for an unknown type. Laravel answered 500.
- `following` returns the tickets the caller follows. Laravel returned the tickets the caller requested.
- `GET /tickets/{reference}` always returns `is_following` and `followers_count`. Laravel left them out.
- `GET /tickets/{reference}` returns `sla_breached`, like the list item. Laravel's `TicketResource` leaves it out.
- A status change the backend refuses is a 422 with `errors.status`, and setting the current status is a 200 no-op. Laravel throws `InvalidArgumentException` from `Ticket::transitionTo` (`src/Models/Ticket.php`, line 932), which answers 500. Setting the current status hits the same exception, except for `resolved`, `closed`, `reopened` and `escalated`, which Laravel routes to their own methods without checking the table.
- `GET /tickets` breaks ties in the sort column by `id`. Laravel orders by the sort column alone (`src/Drivers/LocalDriver.php`, line 139), so tickets created in the same second can repeat or go missing across pages.
