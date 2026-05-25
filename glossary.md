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

## Newsletter system

**Newsletter** — an **admin-only broadcast campaign**. Subject + Markdown body + target list + theme + schedule. Status flows `draft → scheduled → sending → sent` (or `paused`/`failed`). Stored in `escalated_newsletters`. Opt-in via `enable_newsletters` (false by default). See [newsletters](domain-model/newsletters.md).

**NewsletterList** — named recipient bucket. `kind` ∈ `{static, dynamic}`. Static lists carry explicit member rows; dynamic lists carry a saved filter JSON evaluated at Plan time. **Recipients are frozen at Plan time** — mid-send list changes don't affect an active send.

**NewsletterTemplate** — reusable Markdown body + theme slug + optional default subject. Not a campaign; a campaign references one (via `template_id`) and may override the body or theme.

**NewsletterDelivery** — one row per recipient per campaign. Holds the `tracking_token` (40-char random, opaque, unique), snapshotted `email_at_send`, status (`pending|queued|sent|bounced|complained|suppressed|failed`), and open/click/bounce timestamps. Stored in `escalated_newsletter_deliveries`.

**marketing_opt_out_at** — nullable timestamp column on `escalated_contacts`. **Contact-scoped, not list-scoped**: setting it removes the contact from every newsletter, on every list, forever (until admin action). Set by one-click unsubscribe.

**tracking_token** — 40-char random opaque ID per delivery. Embedded in pixel URL, click-redirect URL, unsubscribe URL, and view-in-browser URL. Token resolution is constant-time on unknown tokens to prevent enumeration.

**Newsletter pipeline** — `Submit → Plan → Dispatch → Track`. Submit is admin save; Plan freezes recipients into delivery rows; Dispatch is the cron-tick batch worker; Track ingests opens/clicks/bounces from both ESP webhooks and self-hosted endpoints. See [newsletters](domain-model/newsletters.md).

**Newsletter theme** — a server-side template file in the host's templating language (Blade, Handlebars, ERB, Jinja, Twig, EEx, Edge, Go html/template, Razor or plain HTML). Each backend ships `default` and `branded`; customers add themes by dropping files into the conventional theme directory.

**newsletters.manage** / **newsletters.send** — the two new permissions. `manage` covers authoring + lists + templates + test-send; `send` covers Schedule and Send Now. Both seeded onto the Admin role by default; split so a future Marketing role can have one without the other.

## Guest submission

**Guest policy** — admin setting with three modes: `unassigned` (default), `guest_user`, `prompt_signup`. Controls what identity a guest-submitted ticket gets. See [guest-policy](domain-model/guest-policy.md).

**Widget** — the `<script>` tag + Vue component embedded on a host site's public pages. Submits tickets via `POST /{prefix}/widget/tickets`. Prefix is `/support` by default, configurable via `data-widget-path`.

## Portfolio

**NestJS reference** — `escalated-nestjs`. The canonical implementation. New features land here first; the 10 host plugins mirror from it.

**Host plugin** — a framework-specific package (`escalated-laravel`, `escalated-rails`, etc.) that installs Escalated into an existing host app. Shares the Vue frontend but has its own backend, migrations, and idioms.

**Shared frontend** — `@escalated-dev/escalated`, the Vue 3 + Inertia UI package. Every framework's backend serves it the same way.

**Docs repo** — `escalated-docs`. User-facing product documentation. Kept in sync with behavior changes.
