# Guest Identity Policy

Admin-configurable setting that controls what identity a guest-submitted ticket gets. Three modes. Default is `unassigned`. Setting lives in the Escalated settings store under key `guest_policy_mode` (plus `guest_policy_user_id` and `guest_policy_signup_url_template` as needed per mode).

A "guest" is anyone who hits the public widget or sends inbound email where the sender isn't a known host-app user.

---

## The three modes

### `unassigned` (default)

Ticket has no host-app user attached. `Ticket.requesterId = 0`. Contact is still created and linked via `Ticket.contactId`. `guest_name` and `guest_email` are populated for agent visibility.

Use when the host app doesn't want guest submissions to create host-app user records (most self-serve products, marketing sites, open public forms).

### `guest_user`

Every guest ticket is routed to a single configured "guest" host-app user. `Ticket.requesterId = settings.guest_policy_user_id`. Contact is still created. `guest_name` / `guest_email` still populated.

Use when the host app's permission model requires a real user on every ticket (e.g. the agent UI has "requester profile" views that 404 on user id 0). Admin creates a dedicated user (often named `Guest Submissions`) and points all guest tickets at it.

Misconfigured `guest_user` (zero, null, or deleted user id) falls through to `unassigned` in every framework. Bad admin input must not 500 public submissions — this is covered by tests in the widget/inbound sweeps.

### `prompt_signup`

Guest submission is accepted immediately as `unassigned` behavior. Additionally, a signup-invite email is emitted (via event `escalated.signup.invite`), containing a host-rendered URL where the guest can complete account creation. When they do, the host calls `ContactService::promoteToUser` which back-stamps `requesterId` on all the guest's prior tickets.

Use when the host wants to convert guest submitters into real users but doesn't want to force signup up-front (best UX — zero friction at submission, optional onboarding after).

`guest_policy_signup_url_template` is a host-provided URL pattern (e.g. `https://app.example.com/signup?contact_token={token}`) rendered with a signed contact token. Template shape is host-defined; Escalated only substitutes `{token}`.

---

## Where the policy is read

Two code paths, both checked post-2026-04 widget-and-inbound sweep:

- **Widget controller** — `POST /{prefix}/widget/tickets`. Before ticket create, resolves guest_policy_mode and applies the requester id rule.
- **Inbound email orchestration** — `InboundEmailService` / equivalent. When creating a new ticket from an unrecognized sender, same resolution.

Both paths go through a per-framework helper (`resolveGuestPolicy` in TypeScript hosts, `_apply_guest_policy` in Python, etc.) so the 3-mode branching is single-sourced per framework.

---

## Portfolio status

All 6 widget-capable frameworks covered for both widget and inbound paths as of 2026-04-24. NestJS is the reference.

`prompt_signup` is accepted and recorded but the signup-invite event emission is a per-framework listener follow-up (not yet implemented on legacy plugins). It behaves exactly like `unassigned` until that listener ships.

---

## See also

- [ticketing-model](ticketing-model.md) — how `requesterId` and `contactId` compose on a ticket
- [email-threading](email-threading.md) — how inbound email submissions become tickets
