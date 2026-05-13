# Glossary

One-line definitions for Escalated-specific terms. Ambiguous words get the most attention because those are the ones that cause re-derivation in new sessions.

For the "why" behind a term, follow the link into `domain-model/`.

---

## Core ticketing

**Ticket** — the central domain object. Belongs to a `requester` (who needs help) and optionally an `assignee` (the agent working it). Carries `status`, `priority`, `ticket_type`, `channel`, and references to `Department`, `SlaPolicy`, optional `Contact`.

**Reply** — a message posted on a ticket. Can be a public reply (visible to the requester) or an `internal_note` (agent-only). Also represents inbound email replies.

**Requester** — the person who opened the ticket. Historically a host-app user (`requesterId: number`). Guests have `requesterId = 0` (or a configured guest user id — see [guest-policy](domain-model/guest-policy.md)).

**Contact** — first-class identity for guest requesters. Deduped by email. Linked to a ticket via `Ticket.contactId` (nullable). Can later be promoted to a host-app user. See [ticketing-model](domain-model/ticketing-model.md).

**Assignee** — the agent currently working the ticket (`assignedTo: userId`, nullable).

**Department** — organizational routing unit. Tickets can be assigned to a department; agents are members of departments.

## Automation layer

**Workflow** — an **admin-configured, event-driven** rule. Fires when a domain event occurs (`ticket.created`, `ticket.updated`, `ticket.assigned`, `ticket.status_changed`, `reply.created`). Conditions are `{field, operator, value}`. Actions are a fixed catalog (`change_priority`, `add_tag`, `assign_agent`, `send_webhook`, `delay`, …). See [workflows-automations-macros](domain-model/workflows-automations-macros.md).

**Automation** — an **admin-configured, time-based** rule. A cron loop scans open tickets periodically and fires actions on any matching a condition (e.g. `hours_since_created > 48`, `hours_since_updated > 4 AND priority = high`). Required for "auto-close anything untouched for 48h" — impossible as a Workflow because silence emits no event. See [workflows-automations-macros](domain-model/workflows-automations-macros.md).

**Macro** — an **agent-applied, manual, one-click** action bundle. Agent selects a macro from a dropdown on a specific ticket; the bundled actions (e.g. `set_status: resolved`, `add_reply: <canned>`, `add_tag: billing`) execute at once. Not a rules engine — zero conditions, zero triggers. See [workflows-automations-macros](domain-model/workflows-automations-macros.md).

**Canned response** — a named pre-written reply body that an agent can insert manually or via a Macro action (`insert_canned_reply`). Supports `{{field}}` interpolation.

**Escalation rule** — legacy term; still exists as its own entity in some hosts. Overlaps with Automations conceptually (time-based) but has different UI and a narrower action set. Treated as its own category for now.

## Skill routing

**Skill** — an admin-managed capability label (e.g. "Networking"). Stored in `escalated_skills`. Names are display-only since 2026-05-13; routing uses explicit mapping tables, not name-match. See [skills-management](domain-model/skills-management.md).

**Routing tag (skill)** — an `escalated_skill_routing_tags` row mapping `(skill_id, tag_id)`. Reads as: "tickets with this tag require this skill." Admin-managed via Admin → Skills → Edit.

**Routing department (skill)** — an `escalated_skill_routing_departments` row mapping `(skill_id, department_id)`. Reads as: "tickets in this department require this skill."

**Agent proficiency** — `escalated_agent_skills.proficiency`, a 1..5 smallint self-rating per `(user_id, skill_id)`. Used by `SkillRoutingService.findMatchingAgents` to break ties (higher proficiency wins, then existing capacity rules apply).

## Email plumbing

**Message-ID** — outbound emails set `Message-ID: <ticket-{id}@{domain}>` (and `<ticket-{id}-reply-{replyId}@{domain}>` for replies). Canonical across all frameworks after the 2026-04 email rollout. See [email-threading](domain-model/email-threading.md).

**Signed Reply-To** — `reply+{id}.{hmac8}@{replyDomain}`. HMAC-SHA256 truncated to 8 chars keyed by `inboundReplySecret`. Verified timing-safely on inbound.

**Inbound routing chain** — 5-priority resolution for matching an inbound email to a ticket: (1) `In-Reply-To` header → our Message-ID, (2) `References` header → our Message-ID, (3) signed Reply-To address, (4) subject `[TK-XXX]` reference, (5) legacy `InboundEmail.message_id` lookup.

**Provider parser** — framework-agnostic interface that adapts Postmark / Mailgun / SES webhooks into a common `InboundMessage` DTO. The router operates on that DTO.

## Guest submission

**Guest policy** — admin setting with three modes: `unassigned` (default), `guest_user`, `prompt_signup`. Controls what identity a guest-submitted ticket gets. See [guest-policy](domain-model/guest-policy.md).

**Widget** — the `<script>` tag + Vue component embedded on a host site's public pages. Submits tickets via `POST /{prefix}/widget/tickets`. Prefix is `/support` by default, configurable via `data-widget-path`.

## Portfolio

**NestJS reference** — `escalated-nestjs`. The canonical implementation. New features land here first; the 10 host plugins mirror from it.

**Host plugin** — a framework-specific package (`escalated-laravel`, `escalated-rails`, etc.) that installs Escalated into an existing host app. Shares the Vue frontend but has its own backend, migrations, and idioms.

**Shared frontend** — `@escalated-dev/escalated`, the Vue 3 + Inertia UI package. Every framework's backend serves it the same way.

**Docs repo** — `escalated-docs`. User-facing product documentation. Kept in sync with behavior changes.
