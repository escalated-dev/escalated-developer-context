# Workflow admin contract

What the shared admin UI (`@escalated-dev/escalated`) and a backend exchange to list, create, edit, enable and reorder **Workflows**. [workflows-automations-macros.md](workflows-automations-macros.md) says what a Workflow *is*. This doc says what goes over the wire.

## Why this exists

Until September 2026 there was no written contract, and no backend and the builder agreed:

- **The builder** posted `trigger` with underscore names (`ticket_created`), conditions as `{match, conditions}`, and actions as `{type, config}`.
- **The engines** in 10 of the 11 backends evaluate `trigger_event` with dotted names, conditions as `{all}` or `{any}`, and actions as `{type, value}`.
- **Laravel** used `{match, rules}` and action names of its own.

So a workflow built in the UI could not be saved on Laravel. On the backends where it saved, it could never match an event.

Every backend test passed through all of this, because each one posted the backend's own field names straight to the endpoint. **A backend's tests for this surface must use the request body below**, not whatever its own engine happens to store.

This doc is canonical. Where a backend disagrees, fix the backend.

---

## Pages

| Page | Props |
|---|---|
| `Escalated/Admin/Workflows/Index` | `workflows`: array of [workflow objects](#the-workflow-object) |
| `Escalated/Admin/Workflows/Form` | `workflow` (`null` when creating), `trigger_events`, `action_types`, `operators` |
| `Escalated/Admin/Workflows/Logs` | not covered here yet |

The same `Form` page serves both create and edit.

## The workflow object

As serialized into page props. Keys are snake_case.

| Key | Type | Notes |
|---|---|---|
| `id` | integer | |
| `name` | string | |
| `description` | string or null | Omit it if the backend has no such column. |
| `trigger_event` | string | Dotted, e.g. `ticket.created`. |
| `conditions` | object | See [Conditions](#conditions). |
| `actions` | array | See [Actions](#actions). |
| `is_active` | boolean | |
| `position` | integer | |
| `trigger_count` | integer | Optional. |
| `last_triggered_at` | ISO 8601 string or null | Optional. |

A read-only `trigger` alias of `trigger_event` is harmless, and most backends send one. The UI reads `trigger_event` first.

## Option lists

`trigger_events` and `action_types` may arrive in any of three shapes, and the UI accepts all of them:

```js
[{ value: 'ticket.created', label: 'Ticket created' }]   // preferred
['ticket.created']                                         // label derived from the value
{ 'ticket.created': 'Ticket created' }                     // value -> label map
```

- **List what the backend can actually do.** For `trigger_events`, that means the events it fires. For `action_types`, it means the actions its executor handles. The UI shows exactly the list it is given.
- **When a list is absent**, the UI falls back to the canonical defaults: the five triggers in the domain-model doc and the core action catalog below.

`operators` is an optional list of operator names. It uses the same shapes and has the same fallback.

## Create and update

| | Method | Path | Route name |
|---|---|---|---|
| Create | `POST` | `{prefix}/admin/workflows` | `escalated.admin.workflows.store` |
| Update | `PUT` | `{prefix}/admin/workflows/{id}` | `escalated.admin.workflows.update` |

The request body is JSON (an Inertia form visit):

```json
{
  "name": "Route refunds to billing",
  "description": null,
  "trigger_event": "ticket.created",
  "conditions": {
    "all": [{ "field": "subject", "operator": "contains", "value": "refund" }]
  },
  "actions": [
    { "type": "change_priority", "value": "high" },
    { "type": "set_department", "value": "4" }
  ],
  "is_active": true
}
```

The keys are **top-level**. They are not nested under a `workflow` key.

**Validation:**
- `name`, `trigger_event` and `actions` are required.
- `actions` needs at least one entry.
- `conditions` may be omitted; treat that as `{"all": []}`.

**Response:**
- **Success:** redirect to the workflows index with a success flash.
- **Validation failure:** redirect back with the errors in the session, per the Inertia convention.

An Inertia form visit cannot consume a JSON `201`. A backend that also serves a JSON API may keep doing so for requests without the `X-Inertia` header.

## Conditions

```json
{ "all": [ condition, ... ] }
{ "any": [ condition, ... ] }
```

- **One key only:** a conditions object has exactly one of `all` (every condition must match) or `any` (at least one must match).
- **Empty list:** matches every ticket.
- **Condition shape:** a condition is `{ "field": string, "operator": string, "value": string }`.

**Fields:** `status`, `priority`, `ticket_type`, `channel`, `subject`, `description`, `tags`, `department_id`, `assigned_to`, `hours_since_created`, `hours_since_updated`.

**Operators:**
- **Equality:** `equals`, `not_equals`
- **Text:** `contains`, `not_contains`, `starts_with`, `ends_with`
- **Comparison:** `greater_than`, `less_than`, `greater_or_equal`, `less_or_equal`
- **Presence:** `is_empty`, `is_not_empty`

A backend may support more fields and operators, and should advertise them in `operators`. It must accept at least these.

## Actions

```json
{ "type": string, "value": string }
```

In what the builder sends, `value` is always a scalar.

**Core catalog.** Every backend must handle these:

| `type` | `value` |
|---|---|
| `change_status` | status slug, e.g. `open` |
| `change_priority` | priority slug, e.g. `high` |
| `add_tag`, `remove_tag` | tag name |
| `set_department` | department id |
| `assign_agent` | host user id of the agent |
| `add_note` | note body; may contain `{{field}}` templates |
| `insert_canned_reply` | reply body |

**Optional actions.** The builder offers these only when the backend lists them in `action_types`:

| `type` | `value` |
|---|---|
| `add_follower` | host user id |
| `delay` | minutes, as a number |
| `send_webhook` | URL |

## Enabling and reordering, from the Index page

| | Method | Path | Body |
|---|---|---|---|
| Toggle | `POST` | `{prefix}/admin/workflows/{id}/toggle` | none; flips `is_active` |
| Reorder | `POST` | `{prefix}/admin/workflows/reorder` | `{ "workflow_ids": [3, 1, 2] }` in the new order |
| Delete | `DELETE` | `{prefix}/admin/workflows/{id}` | none |

Toggle and delete redirect back to the index.

## Shapes a backend must keep reading

The contract changes what the UI **sends**. Workflows already stored in an older shape must keep working, so backends keep evaluating them:

- **Laravel:** conditions stored as `{match: 'all'|'any', rules: [...]}`, and the action names `move_department`, `add_internal_note` and `snooze_ticket`. These stay aliases of the canonical names.
- **Any backend:** conditions stored as a flat list, which is treated as `all`.

## Checking a backend against it

A backend that renders these pages needs at least three tests:

1. **Create:** POST the example body above over HTTP, and assert the stored workflow has the same `trigger_event`, conditions and actions.
2. **Execution:** fire the stored workflow's trigger on a ticket that matches, and assert the actions ran. A saved workflow that never runs is the failure this contract exists to prevent.
3. **Form props:** render the create page, and assert `trigger_events` and `action_types` are present.
