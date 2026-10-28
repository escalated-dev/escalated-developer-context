# Mobile guest API

The JSON routes a mobile app uses to let a **guest** (no account) file a ticket,
read it, reply to it and get back into it later. They are the mobile face of
verified guest access: the same email codes, the same expiring grants and the
same rate limits as the browser and widget guest routes. Only the route prefix
and the payload shapes differ.

escalated-laravel is the port of record (`routes/mobile-api.php`,
`Http/Controllers/Api/MobileGuestTicketController.php`,
`Http/Controllers/Guest/VerificationController.php`,
`Http/Resources/MobileTicketResource.php`, `docs/guest-access.md`). This doc is
canonical. Where a backend disagrees, fix the backend.

Out of scope here: the authenticated customer mobile routes (`auth/*`,
`tickets/*` with a customer API token), mobile knowledge base and departments.

---

## Where the routes live

All five routes hang off the backend's mobile prefix, which is its REST API
prefix plus `/mobile`. Laravel's is `support/api/v1/mobile`; a backend whose API
lives at `escalated/api/v1` uses `escalated/api/v1/mobile`. The suffixes below
are identical everywhere.

| Method | Path (under the mobile prefix) | Rate limit bucket |
|---|---|---|
| POST | `/guest/verification` | submissions |
| POST | `/guest/lookup` | replies |
| POST | `/guest/tickets` | submissions |
| GET | `/guest/tickets/{token}` | requests only |
| POST | `/guest/tickets/{token}/replies` | replies |

The routes are registered only when the backend's REST API is enabled
(Laravel: `escalated.api.enabled`, default off). Hosts that never enabled the API
see no new routes.

`{token}` is the guest grant itself (see below), not the ticket reference.

## Authentication

There is no API token and no session. A guest proves mailbox ownership once
with an emailed code, and receives a **grant**: an opaque, encrypted, expiring
bearer credential bound to one ticket, the verified email and the `ticket`
purpose. Every port already issues these for its browser/widget guest routes;
the mobile routes must reuse that exact issuer and resolver, so:

- a grant from the mobile create works on the browser guest page and the widget
  `tickets/{reference}` route, and a grant from a browser/widget create or
  lookup works on the mobile routes;
- a chat grant never opens a ticket route (404);
- an expired, rotated, revoked, malformed or over-long grant is a **404**, never
  a 401/403, so a probe learns nothing.

Clients must treat the grant as opaque. Do not parse it or assume a length.

## Rate limits

Two layers, both keyed by client IP:

1. **API layer.** The whole mobile prefix shares the API limiter (Laravel:
   `escalated.api.rate_limit`, 60 per minute per IP for unauthenticated
   requests). Responses carry `X-RateLimit-Limit` and `X-RateLimit-Remaining`.
   Over the limit: `429 { "message": "Too many requests.", "retry_after": n }`
   with `Retry-After`.
2. **Guest layer.** The same per-IP guest budgets the browser and widget guest
   routes use, shared with them (one budget per IP across all three
   surfaces, not a fresh one per surface). Laravel defaults:
   - requests: 60 per minute, every guest route;
   - submissions: 5 per minute, `verification` and `tickets` create;
   - replies: 30 per minute, `lookup` and `replies`.
   Over the limit: 429 with `Retry-After`.

On top of that, code delivery keeps its per-mailbox budgets (3 per mailbox per
client IP per hour, 10 per mailbox per hour across all IPs), exactly as on the
other surfaces.

A port that already has a guest limiter with different bucket names applies the
same buckets to the mobile routes; it does not invent a mobile-only budget.

## Response headers

Every guest route answer, success or error, carries:

```
Cache-Control: private, no-store
Referrer-Policy: no-referrer
```

Hosts should redact the `{token}` path segment from access logs.

---

## POST `/guest/verification`

Request a code. Same handler as the browser/widget `verification` route.

```json
{ "email": "recipient@example.com", "purpose": "ticket" }
```

- `email`: required, email, max 255.
- `purpose`: required, one of `ticket`, `chat`, `lookup`.
- `ticket` and `lookup` need guest tickets enabled; `chat` needs chat enabled.
  Otherwise 403.

`202`:

```json
{ "verification_id": "<uuid>", "expires_in": 600, "message": "Check your email for a verification code." }
```

The code (eight digits) is only ever in the email. It is bound to the
normalized (trimmed, lower-cased) email and the purpose, expires in ten minutes,
allows five guesses and is spent once.

## POST `/guest/lookup`

Get fresh grants for existing tickets. Same handler as the other surfaces.

```json
{ "email": "...", "reference": "ESC-00042", "verification_id": "...", "verification_code": "..." }
```

Needs guest tickets enabled (403 otherwise) and a `lookup`-purpose code.
`200 { "data": [ { "reference", "subject", "guest_access_token", "expires_at" } ] }`,
at most 20 tickets whose guest email matches. The list may be empty; the code is
spent either way. A bad code is 422 with an error on `verification_code`.
Issuing a grant rotates the ticket's grant, so earlier links stop working.

## POST `/guest/tickets`

Create a ticket. JSON or `multipart/form-data` (for attachments).

| Field | Rules |
|---|---|
| `name` | required, string, max 255 |
| `email` | required, email, max 255 |
| `subject` | required, string, max 255 |
| `description` | required, string, max 65535 |
| `verification_id` | required, uuid |
| `verification_code` | required, string, max 16 |
| `priority` | optional, one of `low`, `medium`, `high`, `urgent`, `critical`; default is the configured default priority (`medium`) |
| `department_id` | optional, an existing department |
| `attachments[]` | optional, at most 10 files, each within the configured attachment size limit |

Order of checks:

1. Guest tickets disabled: `403 { "message": "Guest tickets are not enabled." }`.
2. Field validation: 422.
3. Proof: a wrong, expired, spent or other-purpose code is 422 with an error on
   `verification_code`. Nothing is created: no contact, no ticket, no event.
4. Create, in one transaction with spending the code: contact for the email,
   ticket with `guest_name`, normalized `guest_email`, the verified-email
   stamp, channel `web`, the guest identity policy applied, the attachments,
   and a fresh `ticket` grant. A failure rolls back and releases the code.
   The ticket-created event fires after commit.

Anonymous creation cannot set `external_reference`, `metadata`, status or
assignee; unknown fields are ignored.

`201`:

```json
{ "data": <mobile ticket>, "message": "Ticket created." }
```

`data.guest_access_token` and `data.guest_access_expires_at` are set.

## GET `/guest/tickets/{token}`

`200 { "data": <mobile ticket> }` with `replies` filled (public replies only,
newest first). `data.guest_access_token` echoes the grant used. Bad grant: 404.

## POST `/guest/tickets/{token}/replies`

```json
{ "email": "recipient@example.com", "body": "Thanks" }
```

Optional `attachments[]` as above.

1. Bad grant: 404.
2. Ticket closed: `422 { "message": "This ticket is closed." }`.
3. Validation: `body` required, string, max 65535; `email` required, email.
4. `email` (normalized) must equal the ticket's guest email, else
   `403 { "message": "The provided email does not match this ticket." }`.
   This is a second factor on top of the grant, not a substitute for it.
5. Store a public reply with no author (the guest), not an internal note, plus
   attachments. Fire the normal reply-created handling.

`201 { "message": "Reply sent." }`

---

## The mobile ticket object

Allow-listed. Never serialize the ticket model. `metadata` is always an empty
object, kept for client compatibility. `external_reference`, `chat_metadata`,
internal notes and staff emails/ids never appear.

| Key | Value |
|---|---|
| `id` | ticket id |
| `reference` | ticket reference |
| `guest_access_token` | the grant (create, show), else `null` |
| `guest_access_expires_at` | ISO 8601 grant expiry when a grant is present, else `null` |
| `subject` | string |
| `description` | string, `""` when empty |
| `status` | `{ "value": "open", "label": "Open" }` |
| `priority` | `{ "value": "medium", "label": "Medium" }` |
| `channel` | e.g. `"web"` |
| `metadata` | `{}` |
| `requester` | `{ "name", "email" }`: the guest name (or `"Guest"`) and guest email |
| `assignee` | `null`, or `{ "id": 0, "name": <agent display name or "Support">, "email": "" }` |
| `department` | `null` or `{ "id", "name" }` |
| `tags` | `[]` for guests |
| `replies` | see below; `[]` on create |
| `activities` | `[]` |
| `sla` | `{ "first_response_due_at", "first_response_at", "first_response_breached", "resolution_due_at", "resolution_breached" }` (timestamps ISO 8601 or `null`, flags boolean) |
| `is_following` | `false` |
| `followers_count` | `0` |
| `resolved_at`, `closed_at` | ISO 8601 or `null` |
| `created_at`, `updated_at` | ISO 8601 |

Status labels: Open, In Progress, Waiting on Customer, Waiting on Agent,
Escalated, Resolved, Closed, Reopened, Live. Priority labels: Low, Medium,
High, Urgent, Critical. A port with its own label table uses it.

Each reply:

| Key | Value |
|---|---|
| `id` | reply id |
| `body` | string |
| `is_internal_note` | `false` |
| `is_pinned` | boolean |
| `author` | guest's own reply: `{ "id": 0, "name": <guest name>, "email": <guest email> }`; staff: `{ "id": 0, "name": <display name or "Support">, "email": "" }` |
| `attachments` | `[ { "id", "filename", "mime_type", "size", "url" } ]`, where `url` is the port's guest-authorized download URL for this grant |
| `created_at` | ISO 8601 |

## Errors

Validation errors are 422 in the backend's usual JSON validation shape (Laravel:
`{ "message": "...", "errors": { "field": ["..."] } }`). Use the shape the port
already returns for its widget guest routes.

## Testing

Each port tests these through its real HTTP stack, with the request bodies
above:

- create without proof is 422 and creates no contact or ticket;
- verification, then create, returns 201 with a grant; reusing the code is 422;
- the grant opens `GET` here and the browser/widget guest routes;
- a reply with a differently-cased matching email is 201; a mismatched email is
  403; a closed ticket is 422;
- an expired grant and a chat grant are 404;
- internal notes never appear;
- the guest rate limit answers 429 with `Retry-After`;
- the routes do not exist while the REST API is disabled.

## See also

- [guest-policy](guest-policy.md): which requester a guest ticket gets
- Each backend's `docs/guest-access.md`: keys, migrations and per-port limits
