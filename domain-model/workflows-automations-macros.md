# Workflows vs Automations vs Macros

Escalated has **three distinct automation surfaces**. They answer different questions, have different audiences, and do not subsume one another. Conflating them is the most common domain mistake.

This doc is the canonical source. When a PR, commit, or doc disagrees with this, this doc wins — fix the other thing.

---

## The split at a glance

| | Workflows | Automations | Macros |
|---|---|---|---|
| **Audience** | Admin | Admin | Agent |
| **Invocation** | Automatic (event) | Automatic (cron) | Manual (click) |
| **Model** | Push / reactive | Pull / proactive | On-demand |
| **Answers** | "What should happen **when** X happens to a ticket?" | "What should happen to tickets that **are** in state Y right now?" | "I want to apply this bundle of actions to *this* ticket, now." |
| **Scope** | One ticket (the one the event fires on) | All open tickets matching conditions | One ticket (the one the agent is viewing) |
| **Typical example** | "When a ticket is created with subject containing 'refund', set priority=high and assign to billing department" | "Every 5 minutes, close any ticket in status=waiting untouched for >72h" | Agent clicks "Escalate to tier 2" → ticket gets tag `tier-2`, priority `high`, status `open`, assignee unset |

---

## Workflows — admin, event-driven

**Triggers** — exactly 5 domain events:
- `ticket.created`
- `ticket.updated`
- `ticket.assigned`
- `ticket.status_changed`
- `reply.created`

**Conditions** — a list of `{field, operator, value}` clauses evaluated against the triggering ticket. Supported operators include `=`, `!=`, `>`, `<`, `contains`, `matches` (regex, ReDoS-protected).

**Actions** — fixed catalog. Core (every framework): `change_priority`, `add_tag`, `remove_tag`, `change_status`, `set_department`, `assign_agent`, `add_note`, `insert_canned_reply`. Deferred (NestJS-reference-first, ports follow): `send_webhook` (SSRF-protected), `assign_round_robin`, `add_follower`, `delay`.

**Execution semantics** — `stopOnMatch` is honored. Errors caught per-workflow, stamped on `WorkflowLog`, don't break the chain.

**Cannot do** — anything time-based. Silence emits no event, so "auto-close tickets nobody touched for 48 hours" is structurally impossible in Workflows.

**Backend stack per framework** — 3 layers:
- `WorkflowEngineService` — evaluates conditions, dispatches actions, interpolates `{{field}}` templates.
- `WorkflowRunnerService` — `runForEvent(event, ticket, workflows)`. Filters to matching triggers, orders by sort/priority.
- `WorkflowListener` — framework-native bridge. Spring uses `@EventListener`, .NET uses `IEscalatedEventDispatcher` decorator, WordPress hooks into existing `escalated_*` actions, Phoenix uses explicit helpers (no auto-emit).

**Frontend** — `src/pages/Admin/Workflows/` (Builder.vue, Index.vue, Logs.vue).

---

## Automations — admin, time-based

**Trigger** — a cron tick (typically every 5 min). Runs `AutomationRunner::run()` which scans **all active automations** against **all open tickets**.

**Conditions** — a list of `{field, operator, value}` clauses, but the field vocabulary is different from Workflows because the question is different. Typical fields:
- `hours_since_created` — most common, for stale-ticket handling
- `hours_since_updated` — for idle-ticket handling
- `hours_since_assigned` — for ignored-ticket handling
- `status`, `priority`, `assigned` (assigned/unassigned), `ticket_type`, `subject_contains` — narrowing filters

**Actions** — similar catalog to Workflows but narrower in practice: `close`, `change_status`, `change_priority`, `add_tag`, `add_note`, `reassign`.

**Execution semantics** — `last_run_at` is stamped on the automation row after each run. Idempotent on the query side (same conditions match the same tickets) but actions are NOT guaranteed idempotent — author's responsibility.

**Cannot do** — react to a specific event. By the time the cron fires, minutes may have passed.

**Backend** — per-framework `AutomationRunner` service + scheduled job (`escalated_run_automations` on WordPress, Laravel scheduler, Rails cron, etc.).

**Frontend** — `src/pages/Admin/Automations/` (Form.vue, Index.vue).

**Portfolio status (as of 2026-04-26)** — the time-based `AutomationRunner` (or NestJS `AutomationService` + scheduler) ships in all 11 implementations: Laravel, Rails, Django, Adonis, WordPress, .NET, Spring, NestJS (reference), Symfony, Phoenix, and Go. Recorded in [decisions/2026-04-26-automation-macro-backend-parity](../decisions/2026-04-26-automation-macro-backend-parity.md); taxonomy locked in [decisions/2026-04-24-admin-agent-tool-split](../decisions/2026-04-24-admin-agent-tool-split.md).

---

## Macros — agent, manual

**Invocation** — agent clicks a macro button on a specific ticket. No conditions evaluated, no trigger to match. Just "apply these actions now."

**Actions** — similar to Workflow actions but the useful ones for an agent: `set_status`, `set_priority`, `set_department`, `assign`, `add_reply`, `add_note`, `insert_canned_reply`.

**Scope** — one macro, one ticket, one click. Optional `ownerId` restricts visibility to the creator; `scope` can broaden to shared.

**Cannot do** — run automatically. Macros are deliberately agent-driven.

**Backend** — `Macro` entity + `MacroService` (`CRUD + apply(macroId, ticketId, agentId)`) + admin & agent controllers.

**Frontend** — `src/pages/Admin/Macros/` (admin CRUD) + `components/MacroDropdown.vue` (agent-facing, on ticket detail).

**Portfolio status (as of 2026-04-26)** — `Macro` + `MacroService` ship in all 11 implementations above (same host list as Automations). See [decisions/2026-04-26-automation-macro-backend-parity](../decisions/2026-04-26-automation-macro-backend-parity.md).

---

## Common questions

**"Can I collapse Workflows and Automations into one system?"** — No. Workflows can't be time-triggered (no event fires for silence). Automations can't react to an event instant (it runs on a timer). You would end up reinventing one inside the other.

**"Macros could be just Workflows with manual trigger?"** — Possibly in theory, but in practice Macros serve a different UX need (agent picks from a short list on the ticket) and have a different data shape (no conditions; scope/ownership). Keeping them separate keeps the admin surface clean.

**"Which one should I reach for?"** — Decision tree:
1. Does the action need to run the moment something happens on a ticket? → **Workflow**.
2. Does the action need to run on tickets based on how long they've been in some state? → **Automation**.
3. Is a human (agent) deciding when to apply it to a specific ticket? → **Macro**.

**"A single feature needs both event-driven AND time-based handling."** — Build both. Example: SLA breach handling has a Workflow that fires on `ticket.created` to stamp `resolution_due_at`, and a separate dedicated cron (`escalated_check_sla`) that scans for breaches. The cron isn't implemented as an Automation in current hosts because the logic is specialized — that's fine. Automations are user-configurable; dedicated crons are code.
