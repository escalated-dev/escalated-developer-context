# 2026-05-13 — Skills routing uses explicit tag/department mapping

**Status:** Accepted

## Context

Until this date, host plugins implemented skill-based routing inconsistently:

- **Rails** matched `Skill.name == Tag.name` implicitly via `SkillRoutingService.find_matching_agents` — no explicit mapping table.
- **Laravel** had a `SkillController` (CRUD on `name` only), an `escalated_skills` migration, and a `SkillRoutingService`, but no routing-tag or routing-department concept.
- **NestJS reference** had only a bare `Skill` entity and a CRUD service. No routing logic, no controller.
- **Django / .NET / Spring** had partial `Skill` model + `SkillRoutingService` only.
- **Adonis / Symfony / WordPress / Phoenix / Go** had nothing.
- `AgentProfile` (NestJS) tracked agents-to-skills via an `escalated_agent_skills` join keyed on `agent_profile_id`, with no proficiency column.

PR #65 on `@escalated-dev/escalated` shipped an admin Skills UI (`Admin/Skills/Index.vue`, `Form.vue`, `SkillTagManager.vue`) that exposes three concepts every backend must support: **explicit routing-tag mapping**, **explicit routing-department mapping**, and **per-agent proficiency 1..5**.

## Decision

Skills routing in every host plugin uses **explicit, admin-managed mapping tables** — not implicit name-matching:

- `escalated_skill_routing_tags` — `(skill_id, tag_id)` join.
- `escalated_skill_routing_departments` — `(skill_id, department_id)` join.
- `escalated_agent_skills` — `(user_id, skill_id, proficiency)` junction. `user_id` (not `agent_profile_id`) for cross-host portability. Proficiency is `smallint` default 3, range 1..5.

Routing semantics, implemented by `SkillRoutingService.findMatchingAgents(ticket)`:

1. Required skills = skills whose `routing_tags` overlap the ticket's tags **OR** whose `routing_departments` contains the ticket's department.
2. Eligible agents = users with rows in `escalated_agent_skills` referencing every required skill.
3. Ordering = sum-of-proficiency desc, then existing capacity / load logic.

Wire contract uses `snake_case` (`routing_tag_ids`, `routing_department_ids`, `agents: [{user_id, proficiency}]`) consistently across hosts. NestJS internal DTOs may use `camelCase` per repo convention; the JSON shape host plugins emit is the contract.

Routes are stable across hosts: `escalated.admin.skills.{index,create,store,edit,update,destroy}`.

Canonical schema, contract, service signatures, and migration guidance live in [domain-model/skills-management](../domain-model/skills-management.md). NestJS reference impl: `escalated-dev/escalated-nestjs` PR #45.

## Consequences

- **Rails** must migrate from name-match `SkillRoutingService` to the explicit-mapping version. A data backfill is needed if any existing `Skill.name == Tag.name` pairings should become explicit `escalated_skill_routing_tags` rows.
- **All hosts** carry an `agent_skills` migration step:
  - If the host already shipped `(agent_profile_id, skill_id)` (e.g. NestJS, Filament-via-Laravel), drop or alter: rename `agent_profile_id` → `user_id` with backfill, add `proficiency` default 3, add timestamps.
  - If the host doesn't have `agent_skills` yet, create fresh.
- Hosts with no Skills implementation today (Adonis, Symfony, WordPress, Phoenix, Go) implement the full stack (migration + model + DTO + controller + routes + admin sidebar + service + tests).
- `Skill.name` is no longer special-cased by routing — names are display-only.
- This ADR supersedes any implicit assumption (in Rails source comments, etc.) that `Skill.name` matches `Tag.name` for routing.

## See also

- [domain-model/skills-management](../domain-model/skills-management.md)
- [2026-04-26 — Automation and Macro backend parity](2026-04-26-automation-macro-backend-parity.md) — established the precedent for portfolio-wide parity ADRs.
