# Adding a New Framework

Step-by-step guide for adding Escalated support to a new backend framework.

## Prerequisites

Before starting, ensure:
- The framework has an ORM or database abstraction
- The framework supports middleware/request pipeline patterns
- There is an Inertia.js adapter available (or you plan headless-only mode)
- The framework has a package distribution mechanism (gem, pip, composer, hex, npm, etc.)

## Steps

### 1. Create the Repository

```
escalated-dev/escalated-{framework}
```

Follow the naming convention: `escalated-{framework}` (lowercase, hyphenated).

Initialize with:
- `README.md` (follow the pattern from `escalated-laravel`)
- `LICENSE` (MIT)
- `CHANGELOG.md`
- CI workflow (`.github/workflows/run-tests.yml`)
- Package manifest (`composer.json`, `pyproject.toml`, `*.gemspec`, etc.)

### 2. Implement the TicketDriver Interface

Create three driver implementations:

```
drivers/
├── local_driver      # Direct DB queries via ORM
├── synced_driver     # Local DB + async sync to cloud API
└── cloud_driver      # HTTP proxy to cloud.escalated.dev
```

The driver interface must support these operations:

| Method | Purpose |
|--------|---------|
| `createTicket(requester, data)` | Create a new ticket |
| `updateTicket(ticket, data)` | Update ticket fields |
| `transitionStatus(ticket, status, causer?)` | Change ticket status |
| `assignTicket(ticket, agentId, causer?)` | Assign to an agent |
| `unassignTicket(ticket, causer?)` | Remove assignment |
| `addReply(ticket, author, body, isNote?, attachments?)` | Add a reply |
| `getTicket(id)` | Fetch a single ticket |
| `listTickets(filters, forUser?)` | List/filter tickets |
| `addTags(ticket, tagIds, causer?)` | Tag a ticket |
| `removeTags(ticket, tagIds, causer?)` | Untag a ticket |
| `changeDepartment(ticket, departmentId, causer?)` | Move to department |
| `changePriority(ticket, priority, causer?)` | Change priority |

A driver manager resolves the active driver from config at boot time.

### 3. Implement the Service Layer

Create services that contain business logic. Services depend on the driver interface, never a concrete driver.

Required services:

| Service | Priority | Purpose |
|---------|----------|---------|
| `TicketService` | Must have | Core ticket operations |
| `AssignmentService` | Must have | Agent assignment (round-robin, capacity) |
| `SlaService` | Must have | SLA evaluation and breach detection |
| `EscalationService` | Must have | Rule evaluation and automatic actions |
| `NotificationService` | Must have | Email dispatch |
| `AttachmentService` | Must have | File upload and storage |
| `ReportingService` | Should have | Metrics and aggregations |
| `MacroService` | Should have | Batch action execution |
| `InboundEmailService` | Should have | Email parsing (Mailgun, Postmark, SES) |
| `PluginService` | Should have | Plugin lifecycle management |
| `WebhookDispatcher` | Should have | Outbound webhook delivery |
| `AutomationRunner` | Nice to have | Trigger-based automations |
| `ImportService` | Nice to have | Data import from other platforms |

### 4. Implement Controllers

Group controllers by role:

```
controllers/
├── admin/          # Admin panel (departments, SLA, rules, settings)
├── agent/          # Agent dashboard (ticket list, detail, replies)
├── api/            # REST API (Bearer token auth)
├── customer/       # Customer portal (own tickets, submit, reply)
└── guest/          # Guest ticket access (via token)
```

Controllers must be thin -- validate input, call a service, return a response.

### 5. Implement UI Renderer Abstraction

Create an interface for rendering pages:

```
render(page: string, props: dict) -> Response
```

The default implementation should use Inertia.js (if an adapter exists for the framework). The interface allows teams to swap in their own rendering (templates, Livewire, etc.).

When the user sets `ui_enabled = false`, skip registering all UI routes. Only API routes, commands, events, and the plugin runtime should be active.

### 6. Implement Plugin Bridge

The bridge spawns the Node.js plugin runtime and communicates via JSON-RPC 2.0 over stdio.

Required functionality:
- Spawn `node node_modules/@escalated-dev/plugin-runtime/dist/index.js` as a child process
- Send hook dispatch messages (action, filter) over stdin
- Read responses from stdout
- Handle `ctx.*` requests from the runtime (query local DB, return results)
- Implement lazy spawning (don't start until first hook dispatch)
- Implement auto-restart with exponential backoff
- Graceful degradation (actions silently skip, filters return unmodified values)

### 7. Add Configuration

Create a config file/mechanism in the framework's idiomatic style:

Required config options:
- `mode` -- Hosting mode (`self-hosted`, `synced`, `cloud`)
- `user_model` -- Host app's user model reference
- `route_prefix` -- URL prefix (default: `support`)
- `ui_enabled` -- Enable/disable built-in UI
- `hosted.api_url` / `hosted.api_key` -- Cloud API connection
- `tickets.*` -- Ticket behavior settings
- `sla.*` -- SLA engine configuration
- `attachments.*` -- File upload limits
- `notifications.*` -- Email notification settings

All env vars should use the `ESCALATED_` prefix.

### 8. Add Migrations

Create migrations for all `escalated_*` tables. Follow the data model defined in [ARCHITECTURE.md](../ARCHITECTURE.md#data-model-core).

All tables must use the `escalated_` prefix. Use the framework's migration system.

### 9. Add Tests

Follow the testing strategy in [TESTING.md](../TESTING.md):

- Unit tests for all services
- Integration tests for all three drivers
- Feature tests for all controller endpoints
- Plugin bridge integration tests

Use the framework's idiomatic test tools.

### 10. Add CI Pipeline

GitHub Actions workflow that:
- Runs on push and pull request
- Tests across relevant version matrices
- Runs linter/formatter checks
- Runs the full test suite

### 11. Update the Docs Repo

Add framework-specific documentation to `escalated-docs`:
- Getting started guide
- Configuration reference
- Frontend integration guide
- Framework-specific notes

### 12. Update This Repo

Add a `repos/escalated-{framework}.md` file to this repo. Update `repos/overview.md` to include the new framework.

## Structural Alignment Checklist

Use this checklist to verify the new implementation matches existing packages:

- [ ] Three drivers (Local, Synced, Cloud) with a manager
- [ ] Service layer with thin controllers
- [ ] UI renderer abstraction with headless mode
- [ ] Plugin bridge with JSON-RPC 2.0 over stdio
- [ ] Routes grouped by role (admin, agent, customer, API, guest)
- [ ] `escalated_` table prefix on all migrations
- [ ] `ESCALATED_` env var prefix
- [ ] `Ticketable` interface/trait/concern on User model
- [ ] Authorization checks at service layer
- [ ] Event dispatching for all ticket operations
- [ ] Inbound email webhook support
- [ ] REST API with Bearer token auth
- [ ] Guest ticket support with token-based access
- [ ] File attachment support
- [ ] SLA engine with business hours
- [ ] Escalation rules engine
- [ ] Tests covering services, drivers, and endpoints
- [ ] CI pipeline with version matrix
- [ ] README following the standard format
