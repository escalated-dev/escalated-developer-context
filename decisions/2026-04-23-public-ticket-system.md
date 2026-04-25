# 2026-04-23 — Public ticket system architecture

**Status:** Accepted

## Context

Escalated needed end-to-end public (anonymous) ticketing: a guest can submit a ticket via a public form *or* inbound email, the ticket is routed automatically by admin-configured rules, the guest receives outbound confirmation/reply emails that thread correctly, and admin has a configurable policy for what identity the guest gets.

The full written plan is at [escalated-dev/escalated `docs/superpowers/plans/2026-04-23-public-ticket-system.md`](https://github.com/escalated-dev/escalated/blob/feat/public-ticket-system/docs/superpowers/plans/2026-04-23-public-ticket-system.md) (~1600 lines, 9 phases). This ADR records the locked architectural decisions that came out of it.

## Decisions locked

### 1. Contact is a first-class entity

Guest ticket = always has a `Contact` row (`email`, optional `name`, optional `userId`). Repeat guests dedupe by email. Added `Ticket.contactId: number | null`. `Ticket.requesterId` preserved for host-app user references.

Rationale: inline `guest_name` / `guest_email` columns on Ticket were the old approach, but they don't dedupe — one guest submitting 10 tickets became 10 unconnected `guest_email` values. Contact makes repeat-guest semantics first-class.

### 2. Guest identity policy has three modes

Admin-configurable setting, default `unassigned`. See [domain-model/guest-policy](../domain-model/guest-policy.md):

- `unassigned` — `requesterId = 0`, Contact populated
- `guest_user` — `requesterId = settings.guestUserId`, Contact populated
- `prompt_signup` — behaves like unassigned until signup completes; then promotes Contact to user

Rationale: three distinct host-app integration patterns. Forcing one model would make Escalated either unusable or clumsy for a sizable minority of hosts.

### 3. Outbound email mandatory

Every framework implements outbound for: ticket-created confirmation, agent reply notification, optional resolution notification, optional signup-invite. Uses framework-native mailer.

### 4. Inbound email with 5-priority resolution

Single webhook endpoint per host (`POST /{prefix}/webhook/email/inbound`). Pluggable parser (Postmark / Mailgun / SES). Resolution chain detailed in [domain-model/email-threading](../domain-model/email-threading.md).

### 5. Threading via canonical Message-ID

Outbound sets `Message-ID: <ticket-{id}@{domain}>` (and `-reply-{replyId}` for replies). Signed Reply-To: `reply+{id}.{hmac8}@{domain}` verified timing-safely with `inboundReplySecret`.

Rationale: deterministic, O(1) outbound, HMAC-signed so attackers can't spoof reply-to addresses.

### 6. Workflow executor wired to event bus

The existing `WorkflowEngineService` gets executed automatically on matching ticket events via a new `WorkflowRunnerService` + `WorkflowListener`. `stopOnMatch` honored, per-workflow errors caught and logged to `WorkflowLog`.

(Workflow is the event-driven admin engine. It is distinct from Automations and Macros — see [decisions/2026-04-24-admin-agent-tool-split](2026-04-24-admin-agent-tool-split.md) for the clean taxonomy.)

### 7. Rate limiting

Existing 100 req/min global ThrottlerModule stays. Public widget gets an additional per-email 10 tickets/hour throttle to prevent abuse.

### 8. NestJS is the reference

New behavior lands in `escalated-nestjs` first, with tests. The 10 host plugins mirror from NestJS in follow-up PRs. Portfolio PRs don't block on simultaneous ports — they can land in any order after the reference.

## Consequences

- `Contact` entity and service must exist in every framework before inbound email or public widget can be correctly implemented. Contact-first migration order per framework.
- `guest_*` inline columns stay populated during a dual-read cycle, then become deprecated reads once Contact is in full production use. Not yet scheduled.
- Frameworks without outbound email today (originally: Rails, Go, Spring) must gain a mailer before the public ticket system is complete for them. Message-ID format is canonical from day one in those three.
- Legacy Message-ID formats in WordPress / Django / Symfony / Phoenix / Adonis / .NET are migrated to the canonical shape; legacy `InboundEmail` table lookup remains as fallback #5 in the resolution chain so pre-migration inbound still routes.

## Status

Accepted 2026-04-23. Implementation across all 11 frameworks tracked in [escalated-dev/escalated `docs/superpowers/plans/2026-04-24-public-tickets-rollout-status.md`](https://github.com/escalated-dev/escalated/blob/docs/rollout-status-update/docs/superpowers/plans/2026-04-24-public-tickets-rollout-status.md).

## See also

- [domain-model/ticketing-model](../domain-model/ticketing-model.md)
- [domain-model/guest-policy](../domain-model/guest-policy.md)
- [domain-model/email-threading](../domain-model/email-threading.md)
- [decisions/2026-04-24-admin-agent-tool-split](2026-04-24-admin-agent-tool-split.md)
