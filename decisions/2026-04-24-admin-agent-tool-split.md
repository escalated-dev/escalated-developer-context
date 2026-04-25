# 2026-04-24 — Admin vs Agent tool split (Workflows / Automations / Macros)

**Status:** Accepted

## Context

The public-ticket-system plan (PR escalated-dev/escalated#31, dated 2026-04-23) contained an audit claim that the `Admin/Automations/` frontend folder was "dead UI with no backend" and proposed repurposing it into the Macros admin page.

That audit was accurate for the NestJS reference (which has never had an `AutomationRunner`) but wrong for the portfolio as a whole. 7 of 11 host plugins (Laravel, Rails, Django, Adonis, WordPress, .NET, Spring) ship a functional time-based `AutomationRunner` service with its own DB table (`escalated_automations`) and cron scheduling. The UI wasn't dead — it was waiting on NestJS parity.

Separately, the plan's framing also conflated the `Workflows` admin engine with the `Automations` admin engine by treating them as interchangeable "admin automation" concepts. They are not interchangeable: one is event-driven, one is time-based, and neither subsumes the other (silence emits no events, so event-driven rules cannot handle stale-ticket handling).

## Decision

**Lock the three-surface taxonomy:**

- **Workflows** — admin-configured, **event-driven** rules engine. Fires on `ticket.created`, `ticket.updated`, `ticket.assigned`, `ticket.status_changed`, `reply.created`.
- **Automations** — admin-configured, **time-based** rules engine. Cron scans open tickets against `hours_since_*` and similar time-threshold conditions.
- **Macros** — agent-applied, **manual** one-click action bundles. No conditions, no triggers.

The two admin engines (Workflows + Automations) co-exist permanently. Neither will be folded into the other.

The agent surface (Macros) is distinct from both admin surfaces and will not be merged with either.

**Frontend consequence:** `src/pages/Admin/Automations/`, `src/pages/Admin/Macros/`, `src/pages/Admin/Workflows/` all exist as separate folders in the shared `@escalated-dev/escalated` package. The `chore(frontend): delete dead Admin/Automations UI` commit on `feat/public-ticket-system` (escalated-dev/escalated#31) has been reverted.

**Backend consequence:** every host framework gets (or eventually gets) all three backends. As of this ADR's lock date:

| Framework | Workflow | Automation | Macro |
|---|:---:|:---:|:---:|
| laravel | done | done | done |
| rails | done | done | done |
| django | done | done | done |
| adonis | done | done | done |
| wordpress | done | done | done |
| dotnet | done | done | done |
| spring | done | done | done |
| **nestjs** (reference) | done | MISSING | done |
| **symfony** | done | MISSING | MISSING |
| **phoenix** | done | MISSING | MISSING |
| **go** | done | MISSING | MISSING |

NestJS gets the Automation backend next (it's the reference, so it must ship first). Symfony / Phoenix / Go port both Automation and Macro in follow-up PRs.

## Consequences

- The public-ticket-system plan (PR escalated-dev/escalated#31) needs its Phase 7 rewritten to not frame Macros as "repurposed from Automations." It's a separate feature that got a new UI, on a path that ran parallel to the Automations folder staying put.
- The NestJS Automation port is on the critical path for the portfolio. Until it ships, the portfolio advertises a feature (Automations UI) that the reference doesn't back.
- Any future design for auto-close-stale-tickets, SLA-breach-reminders, idle-chat-warnings, etc. defaults to **Automation** unless the trigger genuinely is event-shaped.
- Agents applying one-off action bundles always use **Macros**. Macros must NOT grow a condition/trigger model — that's what Workflows is for.

## Alternatives considered

1. **Fold Automations into Workflows.** Rejected — Workflows cannot handle time-based conditions. Would require adding a time-tick pseudo-event and a "stale" condition vocabulary, which reinvents Automations inside Workflows.
2. **Fold Macros into Workflows with manual trigger.** Rejected — Macros' data shape (no conditions, `ownerId`, `scope`) and UX (agent-picked from a dropdown on a ticket) diverge enough that cramming into Workflows would worsen both.
3. **Delete the Automations frontend and keep the backends orphaned.** Rejected — 7 frameworks ship a working backend that customers already use. Deleting the UI strands that feature.
4. **Delete the Automations backends and standardize on Workflows.** Rejected — removes functional user-facing features from production customers. Not worth the simplification.

## Implementation trail

- escalated-dev/escalated@d5fdb58 — revert of the `chore(frontend): delete dead Admin/Automations UI` commit.
- Follow-up PRs (tracked separately): NestJS Automation port; Symfony / Phoenix / Go Automation + Macro ports.

## See also

- [domain-model/workflows-automations-macros](../domain-model/workflows-automations-macros.md) — canonical explainer
- [decisions/2026-04-23-public-ticket-system](2026-04-23-public-ticket-system.md) — the plan this corrects a framing in
