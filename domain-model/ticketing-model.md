# Ticketing Model

The data shapes and relationships behind a ticket. When a ticket is created, who "owns" it as a subject varies: sometimes a host-app user, sometimes a guest contact. This doc explains the invariants.

---

## The three identities

A ticket relates to **who needs help** in three possible ways:

### 1. Host-app user (`requesterId`)

The traditional shape. A logged-in user of the host app submits a ticket; `Ticket.requesterId` is their user id. Works for internal IT-style deployments, authenticated customer portals, anywhere the host already has identity.

- Type: host-app user FK (number, typed per framework: `users.id` in Laravel/Django, custom in WP where it's always a WP user, etc.)
- `0` used to mean "no user" before Contact existed; still means "no user" for guest tickets in `unassigned` mode.
- Polymorphic on some frameworks via `requester_type + requester_id` to support multiple user models — check the specific framework.

### 2. Contact (`contactId`)

New in 2026-04 with the public ticket system. First-class guest identity, deduped by email. A single repeat guest submitter ends up as one Contact row with N tickets linked.

- Type: `Ticket.contactId: number | null`, FK → `Contact.id`.
- Populated on any public submission (widget + inbound email) where the sender is not a known host-app user.
- Can be promoted to a host-app user later via `ContactService::promoteToUser` — back-stamps `requesterId` on all prior tickets.

### 3. Guest fields (`guest_name`, `guest_email`) — legacy

Pre-Contact design. Inline columns on the ticket itself. Kept for backward compatibility during dual-read cycle; slated for deprecation. Every framework still writes them as a fallback view for agents.

- Type: plain strings on the ticket row.
- After Contact dual-read lands in production, these go inline-deprecated (read still works; writes are duplicative with Contact).

---

## Which identity fires when

Controlled by the **guest policy** admin setting. See [guest-policy](guest-policy.md).

| Mode | `requesterId` | `contactId` | `guest_*` |
|---|---|---|---|
| `unassigned` (default) | `0` | `<contact.id>` | set |
| `guest_user` | `<configured guest user id>` | `<contact.id>` | set |
| `prompt_signup` | `0` until signup; then `<new user id>` | `<contact.id>` | set |

So `Contact` is always populated for guests regardless of mode; `requesterId` varies. `guest_*` fields stay populated for agent visibility.

---

## Reply model

**Reply** = a message on a ticket. Two flavors:

- **Public reply** — visible to the requester. Sent outbound via email if the requester has an email. Incoming inbound email is typed as a public reply.
- **Internal note** — agent-only. Never sent outbound, never shown to requester. `is_internal_note = true`.

Additional types: `split_from` / `split_to` metadata on tickets that were split from a reply; `system_note` metadata on bot-authored notes.

Replies relate to tickets N:1. A reply's `authorId` is a host-app user id for agent replies, `null` (or 0) for system/bot/inbound-from-guest replies.

---

## SLA tracking

Three fields on `Ticket` are SLA-computed:

- `first_response_at` — when the first non-internal agent reply went out (= first time the requester got a human response).
- `first_response_due_at` — deadline from SLA policy, computed at ticket create.
- `resolution_due_at` — deadline from SLA policy, same.

Plus booleans: `sla_first_response_breached`, `sla_resolution_breached`. Stamped by the `escalated_check_sla` cron (or framework equivalent).

---

## Invariants

- A ticket ALWAYS has a requester of some kind. `requesterId = 0` with no Contact is invalid post-2026-04.
- A ticket belongs to exactly zero or one department. Zero means unrouted.
- A ticket's `reference` (e.g. `ESC-000123`) is unique, generated at create time, never changes.
- A reply belongs to exactly one ticket and is never moved (splits create new tickets and link via metadata).
- Soft-delete columns (`deleted_at`) exist on Ticket and Reply. Hard delete is not supported in the public API.

---

## See also

- [guest-policy](guest-policy.md) — the 3 modes
- [email-threading](email-threading.md) — how replies get routed back to tickets
- [workflows-automations-macros](workflows-automations-macros.md) — how ticket state changes automatically
