# 2026-11-05: Agent panel data: unread, customer presence, agent status, notifications, KB search

## Status

Accepted.

## Context

The agent panel redesign in the shared frontend (`@escalated-dev/escalated`
0.12.8) has five features with no backend data behind them yet:

1. bold rows and unread dots for tickets the agent has not seen;
2. a green dot when the customer is on the site right now;
3. the agent's own Online / Away / Offline menu, which today only works
   against the **admin** live-chat route;
4. a notifications bell;
5. knowledge-base search inside the ticket workspace (Related panel and the
   composer's "insert article link").

The frontend already reads some of these names (`is_unread`,
`requester_online`, `escalated.agent_status`, see the frontend's
`docs/agent-panel.md`). This ADR fixes the exact shapes, routes and semantics
so every backend that serves the agent panel produces the same data, and the
frontend can wire the rest against one contract.

The owner's constraints:

- **Every feature is additive and optional.** A backend that lacks a feature
  leaves its prop or field out and does not register its route; the frontend
  hides that UI. No placeholder or fake data, ever.
- New props are documented in the frontend's `pages.json` manifest and
  `docs/agent-panel.md`.
- Ticket visibility and departments, light agents, and roles & permissions
  (ADR [2026-10-29](2026-10-29-configurable-access-features.md)) apply to all of
  it exactly as they apply to the ticket list.
- No new event names outside the vocabulary of ADR
  [2026-10-21](2026-10-21-event-vocabulary.md).

escalated-laravel is the reference implementation; the other backends port
this ADR (checklist at the end).

## Decision

Conventions used below:

- `{prefix}` is the install's route prefix (`support` by default). Agent routes
  live under `{prefix}/agent` behind the existing agent middleware (agent
  gate, two-factor, route permissions).
- Timestamps are ISO 8601 strings with a UTC offset, or `null`.
- "JSON request" means the request asks for JSON (`Accept: application/json`)
  and is not an Inertia visit. Mutating routes answer JSON to a JSON request
  and redirect back (Inertia) otherwise.
- Ticket routes take the ticket reference or id, resolved and authorized the
  same way as `escalated.agent.tickets.show` (404/403 for a ticket the agent
  cannot view).

### 1. Unread tracking (per agent)

**Activity.** A ticket carries `last_customer_activity_at` (nullable,
indexed). It is set to the creation time when the ticket is created, and to
the reply's time whenever a **public reply or chat message is written by the
customer side**: the requester (by polymorphic identity, including the guest's
contact) or a guest/no author. Agent replies, internal notes, side
conversations, system events and status changes never touch it, so an
agent's own work never makes a ticket unread. Existing tickets are migrated
with `NULL` (nothing unseen), so the feature does not turn every historic
ticket bold on upgrade.

**Read marker.** Table `{table_prefix}ticket_reads`:

| Column | Type |
|---|---|
| `id` | primary key |
| `user_id` | the agent (host user key type) |
| `ticket_id` | the ticket |
| `last_read_at` | timestamp, **nullable** |
| `created_at`, `updated_at` | timestamps |

Unique on (`user_id`, `ticket_id`); indexed on `ticket_id`. Rows are deleted
with the ticket.

**The rule.** For agent *A* and ticket *T*, with *R* = A's row for T:

```
is_unread =
    R exists and R.last_read_at is NULL                    -- marked unread
 or T.last_customer_activity_at is not NULL and (
        R does not exist
     or T.last_customer_activity_at > R.last_read_at)
```

A backend computes it in the list query (a left join or correlated subquery),
not per row.

**Marking.**

- Opening the ticket in the agent panel (`GET escalated.agent.tickets.show`)
  marks it read for that agent (`last_read_at = now`). Admin screens and API
  reads do not.
- `POST {prefix}/agent/tickets/{ticket}/read`, name
  `escalated.agent.tickets.read`, marks it read.
- `POST {prefix}/agent/tickets/{ticket}/unread`, name
  `escalated.agent.tickets.unread`, marks it unread (`last_read_at = NULL`).
- JSON answer to both: `{ "is_unread": false }` / `{ "is_unread": true }`.
- Bulk: the existing `escalated.agent.tickets.bulk` route accepts
  `action: "mark_read"` and `action: "mark_unread"` (no `value`), applied to
  the given `ticket_ids` the agent can view.

Marking is per agent and never visible to anyone else. It is not an event and
is not logged as ticket activity. Light agents can mark tickets they can view;
no permission is needed beyond viewing.

**Props.**

- `is_unread` (boolean) on every row of `tickets.data` in
  `Escalated/Agent/TicketIndex`, and on `ticket` in `Escalated/Agent/TicketShow`
  (always `false` there, since opening it marked it read).
- Optional `inbox.unread`, beside `inbox.counts`, with the same keys:
  `{ "mine": 3, "unassigned": 5, "all": 11 }`: open (unresolved, unsnoozed)
  tickets in that queue that are unread for this agent, under the same
  visibility scope as `counts`. A missing key shows no unread number.

### 2. Customer online status

**Storage.** Table `{table_prefix}customer_presence`:

| Column | Type |
|---|---|
| `id` | primary key |
| `subject_type` | the requester's polymorphic type (host user model, or the contact model for guests) |
| `subject_id` | its key |
| `last_seen_at` | timestamp |
| `created_at`, `updated_at` | timestamps |

Unique on (`subject_type`, `subject_id`). A ticket's customer is its requester
identity, or its contact when the requester is a guest.

**Recording.** Last-seen is recorded from requests the customer already makes,
with no new client traffic:

- authenticated customer-portal requests (`escalated.customer.*`): the signed-in
  user;
- widget live-chat requests for a session (`start`, `messages` read and post,
  `typing`): the session ticket's customer;
- the widget's ticket status lookup by reference with a valid guest token: that
  ticket's customer.

The write is throttled to at most one per subject per 30 seconds (a cache
key, or an `UPDATE ... WHERE last_seen_at < now - 30s`), so it costs nothing
on a busy chat. A lightweight widget heartbeat endpoint is optional and not
part of this contract; a backend that adds one documents it.

**Window.** A customer is online when `last_seen_at` is within the configured
window, default **120 seconds** (Laravel:
`escalated.presence.online_window_seconds`, env
`ESCALATED_PRESENCE_ONLINE_WINDOW`).

**Fields**, on agent pages only (every row of `tickets.data` in TicketIndex and
`ticket` in TicketShow):

- `requester_online`: boolean;
- `requester_last_seen_at`: timestamp or `null` when never seen.

**Privacy.** These fields are never sent on customer, guest, widget or public
API responses, and the presence table is never exposed through them. Only
staff see a customer's presence.

### 3. Agents setting their own status

**One source of truth.** The status lives on the agent profile, in the field
live-chat routing already uses (Laravel: `agent_profiles.chat_status`). Values:
`online`, `away`, `offline`. An agent with no profile is `offline` (the
column default, and what chat routing assumes).

**Route.** `PUT` or `POST {prefix}/agent/status`, name `escalated.agent.status`,
body `{ "status": "online" | "away" | "offline" }`. Any agent may set their
own status, light agents included; nobody sets another agent's. An invalid
value is a 422. JSON answer: `{ "agent_status": "away" }`; an Inertia visit
redirects back.

**Alias.** The existing admin live-chat route (`escalated.admin.chat.status`)
keeps working and writes the same field. Its response keeps its old keys and
adds `agent_status`.

**Shared props** (inside the shared `escalated` prop, for agents only; absent
for non-agents and guests):

- `agent_status`: the current value, a string;
- `agent_statuses`: `["online", "away", "offline"]`, the values the backend
  accepts.

The frontend posts to `escalated.agent.status` when the route exists, falling
back to `escalated.admin.chat.status`.

**Events.** The event vocabulary has no agent-status event, so none is emitted.

### 4. Notifications feed

**Storage.** Per user. A backend reuses its framework's database notifications
where they fit (Laravel: the `database` notification channel and the host's
`notifications` table, already in `escalated.notifications.channels` by
default); otherwise it adds `{table_prefix}notifications` (`id`, `user_id`,
`type`, `data` JSON, `read_at` nullable, `created_at`). The feed lists only
Escalated's own notifications, never the host's.

The feed is **available** when that storage exists and in-app delivery is on
(Laravel: `database` is in `escalated.notifications.channels` and the
`notifications` table exists). When it is not available the shared prop is
absent and the routes answer 404.

**Triggers** and their `type`:

| `type` | Sent to | When |
|---|---|---|
| `ticket_assigned` | the new assignee | a ticket is assigned to them by someone else |
| `ticket_reply` | the assignee and followers | a customer-side public reply (same rule as unread activity) |
| `mention` | the mentioned agent | an @mention in an internal note (where the backend has mentions) |
| `sla_warning` | the assignee | an SLA target is about to be missed (`sla.warning`) |
| `sla_breached` | the assignee | an SLA target was missed (`sla.breached`) |
| `chat_transferred` | the receiving agent | a live chat is transferred to them |

A backend may send other Escalated types it already has (Laravel also stores
`new_ticket`, `ticket_escalated`, `status_changed`); the frontend shows an
unknown `type` with its `title` and a generic icon. Collision ("someone else is
replying") is not a notification; it stays the ticket page's live presence.
The agent who caused an event is never notified of it.

**Item shape.**

```json
{
    "id": "9f1c4b6e-...",
    "type": "ticket_assigned",
    "title": "ESC-00042 was assigned to you",
    "body": "Printer on fire",
    "ticket": { "id": 42, "reference": "ESC-00042", "subject": "Printer on fire" },
    "url": "https://example.com/support/agent/tickets/ESC-00042",
    "created_at": "2026-11-05T09:12:00+00:00",
    "read_at": null
}
```

`id` is a string (Laravel's notification ids are UUIDs). `title` and `body` are
rendered in the agent's locale at read time; `body` may be `null`. `ticket` and
`url` are `null` for a notification without a ticket. **Visibility:** when the
agent can no longer view the ticket (visibility, department or role change, or
the ticket was deleted), the item is still listed, so the count stays honest,
but `ticket` and `url` are `null`, `body` is `null` and `title` is generic
("A ticket you can no longer view").

**Routes.**

| Method and path | Name | Answer |
|---|---|---|
| `GET {prefix}/agent/notifications` | `escalated.agent.notifications.index` | `{ "data": [items], "meta": { "current_page", "last_page", "per_page", "total" }, "unread_count": 3 }`, newest first; `?page=`, `?per_page=` (default 20, max 50), `?unread=1` for unread only |
| `POST {prefix}/agent/notifications/{id}/read` | `escalated.agent.notifications.read` | `{ "unread_count": 2 }`; 404 for another user's notification |
| `POST {prefix}/agent/notifications/read-all` | `escalated.agent.notifications.read-all` | `{ "unread_count": 0 }` |

All three are JSON. There is no Inertia notifications page in this contract:
a page needs a component in a frontend release first (page-name parity), so
the frontend's "all notifications" view pages through the index route. A
backend may add `Escalated/Agent/Notifications` after the frontend ships it.

**Shared prop.** `escalated.notifications: { "unread_count": 3 }` for agents
while the feed is available.

**Realtime.** When the backend's broadcasting is enabled, each new in-app
notification is broadcast on the agent's existing private channel
`escalated.agents.{userId}` (tenant-prefixed where tenancy applies) as
`notification.created`, with the item as the payload. Without broadcasting,
the frontend refreshes the count on navigation and when the popover opens.

**Mute preferences** are a follow-up (see Consequences), not part of this
contract.

### 5. Knowledge-base search for agents

`GET {prefix}/agent/kb/search?q=...`, name `escalated.agent.kb.search`.

- `q`: required, 2 to 200 characters (422 otherwise). `limit`: optional,
  default 10, max 20.
- Answer: `{ "data": [ { "id", "title", "excerpt", "url", "category", "updated_at" } ] }`
  where `excerpt` is plain text (tags stripped, about 160 characters),
  `category` is `{ "id", "name" }` or `null`, and `url` is the absolute URL of
  the article on the customer-facing knowledge base (what the composer
  inserts into a reply).
- Which articles: published ones. A backend whose KB has internal (agent-only)
  articles includes them for agents and adds `"internal": true` to those rows;
  the composer does not offer "insert link" for internal articles. Drafts are
  never returned.
- Ranking: the backend's existing article search: full-text where the backend
  already has it; otherwise `LIKE`, **with `%`, `_` and the escape character
  escaped**, title matches before body matches, then most recently updated.
- 404 while the knowledge base is turned off for the install.
- Suggested articles for the ticket's subject are optional and not part of
  this contract.

### Documentation

Each new prop and field goes into the frontend's `pages.json` manifest (as an
optional prop of the page that receives it) and `docs/agent-panel.md`. Each
backend lists what it ships in its own docs and CHANGELOG.

## Consequences

- Two new tables (`ticket_reads`, `customer_presence`) and one new ticket
  column (`last_customer_activity_at`) on every backend that ports unread and
  presence, with migrations for every database the backend supports.
- Every port computes `is_unread` and presence in the list query; per-row
  lookups are a defect.
- The admin live-chat status route becomes an alias; there is exactly one
  stored agent status per agent.
- Laravel's in-app `ticket_reply` notification is sent only for customer-side
  replies (its email is unchanged). Hosts that removed `database` from
  `escalated.notifications.channels` get no feed, and the bell stays hidden.
- Follow-ups, not in this contract: per-agent mute preferences for
  notification types; an Inertia `Escalated/Agent/Notifications` page;
  suggested articles for a ticket; a widget heartbeat; unread markers on
  admin ticket screens.

## Alternatives considered

- **Unread from the latest reply's timestamp.** Rejected: the agent's own
  replies and notes would mark tickets unread for everyone else, and telling
  customer replies apart at query time is per-backend guesswork.
- **Backfilling activity from `created_at`.** Rejected: every historic ticket
  would turn bold for every agent on upgrade.
- **Presence in the cache only.** Rejected: it is lost on a cache flush and
  cannot be joined into the list query.
- **A new agent-status column.** Rejected: two sources of truth would drift
  from live-chat routing.
- **`agent_status` as an object.** Rejected: the 0.12.8 frontend already reads
  it as a string.
- **Laravel's `broadcast` notification channel.** Rejected: it broadcasts on
  the host's user channel (`App.Models.User.{id}`), which Escalated does not
  authorize; the agent channel already exists.

## Port checklist

For each of nestjs, rails, django, adonis, symfony, phoenix, go, spring and
dotnet (WordPress: only what wp-admin's own UI can use, see below):

- [ ] Unread: `last_customer_activity_at` column, set on create and on
      customer-side public replies/chat messages; `ticket_reads` table;
      `is_unread` on TicketIndex rows and TicketShow; opening the agent ticket
      page marks read; `escalated.agent.tickets.read` / `.unread`; bulk
      `mark_read` / `mark_unread`; optional `inbox.unread`.
- [ ] Presence: `customer_presence` table; throttled last-seen from portal and
      widget chat/status requests; configurable window (default 120 s);
      `requester_online` and `requester_last_seen_at` on agent pages only.
- [ ] Agent status: `escalated.agent.status` (PUT/POST) for every agent;
      stored in the existing live-chat status field; admin chat status route
      kept as an alias; shared `agent_status` and `agent_statuses`.
- [ ] Notifications: storage, the six trigger types, the item shape including
      the visibility redaction, the three routes, shared
      `notifications.unread_count`, `notification.created` on
      `escalated.agents.{id}` when broadcasting is on.
- [ ] KB search: `escalated.agent.kb.search` with escaped `LIKE` or full-text,
      published (plus internal for agents) only, 404 when the KB is off.
- [ ] Tests through the real HTTP path for each route, and a test that no
      customer, widget or guest response carries `requester_online` or
      `requester_last_seen_at`.
- [ ] Docs and CHANGELOG `[Unreleased]`; a per-backend list of deviations.

**WordPress** renders its agent screens in wp-admin, not the shared agent
panel. It ports what its own screens can show (unread markers and the KB
search, if its ticket screen has a place for them) and skips the shared props.
