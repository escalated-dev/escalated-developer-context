# 2026-10-21: One event vocabulary for webhooks and workflow triggers

## Status

Accepted.

## Context

The 2026-10-20 audit found the eleven backends naming the same domain events
differently. Laravel's workflow builder offered `ticket.replied` while its
webhooks sent `reply.created`. Django and .NET sent `internal_note.added` where
Laravel sends `note.created`. Tag events appeared as `tag.added`, `ticket.tagged`
and `ticket.tag_added`. Chat events appeared as `chat.session_started` and
`chat.started`. A workflow or webhook subscription built against one backend did
not work on another, and the domain docs (`reply.created`) disagreed with the
code (`ticket.replied`).

## Decision

### Canonical names

Every backend emits these names, and only these, to outbound webhooks, workflow
triggers and plugin hooks. They are the names Laravel's webhooks already send.

| Event | Name |
|---|---|
| Ticket created | `ticket.created` |
| Ticket fields changed | `ticket.updated` |
| Status changed | `ticket.status_changed` |
| Resolved / closed / reopened | `ticket.resolved`, `ticket.closed`, `ticket.reopened` |
| Assigned / unassigned | `ticket.assigned`, `ticket.unassigned` |
| Escalated | `ticket.escalated` |
| Priority changed | `ticket.priority_changed` |
| Department changed | `ticket.department_changed` |
| Tag added / removed | `ticket.tag_added`, `ticket.tag_removed` |
| Public reply posted | `reply.created` |
| Internal note added | `note.created` |
| SLA warning / breach | `sla.warning`, `sla.breached` |
| Live chat | `chat.started`, `chat.assigned`, `chat.transferred`, `chat.message`, `chat.ended` |

Workflow triggers use the same names. The reply trigger is `reply.created`,
matching `domain-model/workflows-automations-macros.md`.

### Legacy names

Backends keep accepting these when they **read** stored data (a saved workflow's
`trigger_event`, a webhook's subscribed `events`, an API filter) and treat them
as the canonical name. They never emit them and never offer them in a form.

| Legacy | Canonical |
|---|---|
| `ticket.replied` | `reply.created` |
| `internal_note.added`, `internal_note.created` | `note.created` |
| `tag.added`, `ticket.tagged` | `ticket.tag_added` |
| `tag.removed`, `ticket.untagged` | `ticket.tag_removed` |
| `chat.session_started` | `chat.started` |
| `chat.session_ended` | `chat.ended` |

A backend may rewrite stored legacy names to canonical ones in a migration, but
must keep reading legacy names for at least one minor release after that.

### Out of scope

The cloud sync protocol (`guides/cloud-driver-pattern.md`) is a separate wire
format between a host and Escalated Cloud. Its names (`ticket.tags_added`,
`ticket.tags_removed`) are unchanged.

## Consequences

- Laravel offers `reply.created` in the workflow builder and fires workflows on
  it; saved workflows with `ticket.replied` keep firing.
- Each port maps its legacy names on read and switches emission to the
  canonical list. Ports that do not emit an event yet (see the 2026-10-20 audit)
  add it under the canonical name.
- `ARCHITECTURE.md` lists the canonical names.
