# Skills management

Skills are admin-managed labels attached to agents and used by routing to pick **who** should answer a ticket. The model has three coupled concepts that are easy to confuse:

| | Skill | Routing rule | Agent proficiency |
|---|---|---|---|
| **What it is** | A named capability (e.g. "Networking") | "If a ticket has this tag or lands in this department, prefer agents with this skill" | "Agent #42 self-rates 4/5 on this skill" |
| **Owned by** | Admin | Admin (set on the skill) | Admin (per-skill, per-agent) |
| **Stored in** | `escalated_skills` | `escalated_skill_routing_tags` + `escalated_skill_routing_departments` | `escalated_agent_skills` |

The admin Skills UI in `@escalated-dev/escalated` (`src/pages/Admin/Skills/Index.vue`, `Form.vue`) is the canonical surface and dictates the wire contract every host backend must satisfy.

---

## Wire contract

All payloads use `snake_case` over the wire (matches Inertia / typical REST conventions). NestJS DTOs internally use `camelCase` and are documented separately in `escalated-nestjs/src/dto/admin/`.

### Routes (host plugin)

| Method | Path | Action |
|---|---|---|
| `GET` | `/escalated/admin/skills` | `index` — list page |
| `GET` | `/escalated/admin/skills/new` | `create` — new-form page |
| `POST` | `/escalated/admin/skills` | `store` |
| `GET` | `/escalated/admin/skills/{id}/edit` | `edit` — edit-form page |
| `PUT/PATCH` | `/escalated/admin/skills/{id}` | `update` |
| `DELETE` | `/escalated/admin/skills/{id}` | `destroy` |

Named routes (Laravel / Rails idiom):
- `escalated.admin.skills.index`
- `escalated.admin.skills.create`
- `escalated.admin.skills.store`
- `escalated.admin.skills.edit`
- `escalated.admin.skills.update`
- `escalated.admin.skills.destroy`

### Index payload — props passed to `Escalated/Admin/Skills/Index`

```json
{
  "skills": [
    {
      "id": 1,
      "name": "Networking",
      "agents_count": 3,
      "routing_tags_count": 2,
      "routing_departments_count": 1,
      "updated_at": "2026-05-13T10:32:00Z"
    }
  ]
}
```

### Create / edit payload — props passed to `Escalated/Admin/Skills/Form`

```json
{
  "skill": {
    "id": 1,
    "name": "Networking",
    "routing_tag_ids": [3, 5],
    "routing_department_ids": [1],
    "agents": [
      { "user_id": 42, "proficiency": 4 },
      { "user_id": 91, "proficiency": 2 }
    ]
  },
  "availableAgents":      [{ "id": 42, "name": "Agent Smith", "email": "smith@..." }],
  "availableTags":        [{ "id": 3,  "name": "bug" }],
  "availableDepartments": [{ "id": 1,  "name": "Support" }]
}
```

For the `new` action, `skill` is `null` / omitted; the three `available*` arrays are still passed.

### Store / update body

```json
{
  "name": "Networking",
  "routing_tag_ids": [3, 5],
  "routing_department_ids": [1],
  "agents": [
    { "user_id": 42, "proficiency": 4 },
    { "user_id": 91, "proficiency": 2 }
  ]
}
```

Validation:
- `name` — required, ≤ 100 chars, unique per workspace
- `routing_tag_ids[]` — optional, each must reference an existing tag
- `routing_department_ids[]` — optional, each must reference an existing department
- `agents[].user_id` — must reference an existing agent (User with agent role)
- `agents[].proficiency` — integer 1..5 (default 3 if omitted)

---

## Schema

Three tables. Names use the host plugin's standard `escalated_` prefix.

### `escalated_skills` (existing; extended)
- `id` PK
- `name` varchar(100) not null
- `slug` varchar(100) not null unique
- `description` text nullable
- `created_at`, `updated_at` timestamps

### `escalated_skill_routing_tags` (new)
- `id` PK
- `skill_id` FK → escalated_skills, on delete cascade
- `tag_id` FK → escalated_tags, on delete cascade
- unique `(skill_id, tag_id)`

### `escalated_skill_routing_departments` (new)
- `id` PK
- `skill_id` FK → escalated_skills, on delete cascade
- `department_id` FK → escalated_departments, on delete cascade
- unique `(skill_id, department_id)`

**Storage variant: JSON columns on `escalated_skills`.** Hosts may store routing tag/department IDs as `JSON` columns (`routing_tag_ids`, `routing_department_ids`) directly on the skills row instead of materialising the two join tables, **iff**:

1. The wire payload still emits ID arrays in the names above (`routing_tag_ids`, `routing_department_ids`).
2. The host's `SkillRoutingService` can still answer "which skills are required for this ticket?" efficiently — typically by indexing the JSON column or by a small in-memory scan (acceptable when skills count is < few hundreds).
3. The host's UI counters (`routing_tags_count`, `routing_departments_count`) read from `count($skill->routing_tag_ids ?? [])`, not from a join.

`escalated-laravel` uses this variant (see PR #95). Join-table storage remains canonical for NestJS, Rails, Django, Phoenix, Go, .NET, Spring, Symfony, WordPress, Adonis. Pick whichever fits your framework's idioms; do not block on storage choice when reviewing.

### `escalated_agent_skills` (existing; **migrated**)
Pre-skills-management this table held `(agent_profile_id, skill_id)` and was managed as a simple many-to-many. It is now an explicit junction with a proficiency column and uses `user_id` (not `agent_profile_id`) for portability across hosts.

- `id` PK
- `user_id` FK → users (host's user model) — no DB-level FK on hosts that follow the [#88 portability pattern](https://github.com/escalated-dev/escalated-laravel/issues/88) of not constraining to the host's user table
- `skill_id` FK → escalated_skills, on delete cascade
- `proficiency` smallint not null default 3, check 1..5
- `created_at`, `updated_at` timestamps
- unique `(user_id, skill_id)`

Naming note: the table is `escalated_agent_skills` (plural). Laravel's PR #95 uses the singular Eloquent convention `escalated_agent_skill`; new hosts should use the plural form. Either is acceptable as long as the host's models / ORM resolve correctly.

**Migration note for hosts that already shipped the old `(agent_profile_id, skill_id)` join:** drop the old table and recreate, or `ALTER TABLE` to (a) rename `agent_profile_id` to `user_id` with a backfill from `agent_profiles.user_id`, (b) add `proficiency` (default 3), (c) add timestamps, (d) add primary key.

---

## Service layer

Two services. Names match across hosts.

### `SkillService`
- `listForAdmin()` — used by the index controller. Returns rows shaped for the Index page including the three `*_count` fields.
- `findForEdit(id)` — used by the edit controller. Returns `routing_tag_ids`, `routing_department_ids`, and `agents` arrays.
- `getFormContext()` — returns `available_tags`, `available_departments`, `available_agents`.
- `create(payload)` / `update(id, payload)` / `delete(id)` — sync routing tags, routing departments, and `agent_skills` rows transactionally.

### `SkillRoutingService` (already exists in Rails / Django / Laravel; add elsewhere)
- `findMatchingAgents(ticket)` — returns User collection. Semantics:
  1. Determine the set of required skills for the ticket by:
     - skills whose `routing_tags` overlap with the ticket's tag set, **or**
     - skills whose `routing_departments` contain the ticket's department.
  2. Find agents (`User` rows) with rows in `escalated_agent_skills` referencing **all** required skills.
  3. Order by sum of `proficiency` desc, then by current ticket-load asc (existing capacity logic).

> Note: the older "skill name matches tag name" routing (Rails' original `SkillRoutingService.find_matching_agents`) is superseded by the explicit `escalated_skill_routing_tags` join. Hosts that previously matched-by-name should migrate.

---

## Frontend contract — fixed by `@escalated-dev/escalated`

The shared frontend assumes:
- An admin sidebar entry pointing at `route('escalated.admin.skills.index')`.
- Pages `Escalated/Admin/Skills/Index` (`src/pages/Admin/Skills/Index.vue`) and `Escalated/Admin/Skills/Form` (`src/pages/Admin/Skills/Form.vue`) are present and renderable through the host plugin's Inertia / SSR pipeline.
- `SkillTagManager.vue` is the reusable chip-picker used inside `Form.vue`.

Host plugins do not author Vue. They register the page paths with their Inertia renderer (Laravel: `Inertia::render('Escalated/Admin/Skills/Index')` — same for every host).

---

## Reference implementation

`escalated-nestjs` is the reference for entity, DTO, service, and controller shapes. See `feat/admin-skills-management` (PR #45).

## Per-host status

| Host | State (2026-05-17) | Storage | Note |
|---|---|---|---|
| escalated-nestjs (reference) | ✅ Shipped | Join tables | PR #45 |
| escalated-laravel | ✅ Shipped | JSON columns | PR #95 + #100 (fix: transactions + agent-role validation). |
| escalated-rails | ✅ Shipped | Join tables | PR #55 + #56 (fix: SQL count + case-insensitive name uniqueness). |
| escalated-django | ✅ Shipped | Join tables | PR #52 |
| escalated-dotnet | ✅ Shipped | Join tables | PR #68. Proficiency migrated from string enum to int 1..5 via `LegacySkillProficiency` backfill. |
| escalated-spring | ✅ Shipped | Join tables | PR #62. Vendored `escalated-locale` .properties files until the Maven Central publish pipeline is wired up. |
| escalated-filament | ✅ Shipped | Inherits Laravel | PR #29 — Filament SkillResource exposes routing tags + departments + agent proficiency. Temporarily pins escalated-laravel to `dev-main as 1.4.0`; restore to `^1.4.0` once that release is tagged. |
| escalated-adonis | ✅ Shipped | Join tables | PR #73 |
| escalated-symfony | ✅ Shipped | Join tables | PR #58 (rebased on master during review to drop a duplicate users-management commit). |
| escalated-wordpress | ✅ Shipped | Plugin tables (`{prefix}escalated_*`) | PR #56. 4 tests skipped with TODOs — 2 newly-added skill tests (non-deterministic factory ids) + 2 pre-existing tag-pivot flakes exposed when the earlier PHP fatal stopped masking them. |
| escalated-phoenix | ✅ Shipped | Join tables | PR #66 |
| escalated-go | ✅ Shipped | Join tables | PR #62 |
