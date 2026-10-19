# Architecture

This document describes the core architecture of the Escalated platform -- the patterns, abstractions, and system boundaries that apply across all framework implementations.

## Overview

Escalated is structured as a set of **backend framework packages** that share a **common Vue 3 frontend** and connect to a **cross-framework plugin system**. Each backend package implements the same interfaces (ticket operations, SLA, escalation, assignment) in the idioms of its target framework.

```
                         ┌──────────────────────────┐
                         │   @escalated-dev/escalated│
                         │   Vue 3 + Inertia.js     │
                         │   Shared frontend         │
                         └────────────┬─────────────┘
                                      │ Inertia protocol
    ┌──────────┬──────────┬───────────┼───────────┬──────────┬──────────┐
    │ Laravel  │ Django   │ Rails     │ AdonisJS  │ Phoenix  │ Symfony  │
    │ PHP      │ Python   │ Ruby      │ TypeScript│ Elixir   │ PHP      │
    └────┬─────┴────┬─────┴────┬──────┴────┬──────┴────┬─────┴────┬────┘
         │          │          │           │           │          │
         └──────────┴──────────┴─────┬─────┴───────────┴──────────┘
                                     │
                              ┌──────┴──────┐
                              │ Plugin      │
                              │ Runtime     │
                              │ (Node.js)   │
                              └──────┬──────┘
                                     │ JSON-RPC 2.0 / stdio
                              ┌──────┴──────┐
                              │ Plugin SDK  │
                              │ TypeScript  │
                              └─────────────┘
```

## Three Hosting Modes

Every Escalated backend package supports three hosting modes, controlled by a single config value (`mode`):

### 1. Self-Hosted (`self-hosted`)

All data lives in the host application's database. No external calls. Full data sovereignty.

- Tickets, replies, departments, SLA policies, escalation rules -- all stored locally.
- The `LocalDriver` handles every CRUD operation against the local DB.
- Best for teams that want full control and have their own infrastructure.

### 2. Synced (`synced`)

Data lives locally AND is replicated to the Escalated Cloud API. Enables cross-app visibility, centralized reporting, and the cloud dashboard.

- The `SyncedDriver` writes locally first, then emits sync events to `cloud.escalated.dev`.
- If the cloud is unreachable, operations still succeed locally and sync when reconnected.
- Best for organizations with multiple apps that want a unified view.

### 3. Cloud (`cloud`)

All CRUD is proxied to the Escalated Cloud API. The local DB is not used for ticket data.

- The `CloudDriver` forwards every operation to `cloud.escalated.dev/api/v1`.
- The host app only handles authentication and UI rendering.
- Best for teams that want zero infrastructure overhead.

### Switching Modes

Switching is a config change:

```php
// Laravel: config/escalated.php
'mode' => env('ESCALATED_MODE', 'self-hosted'),
```

```python
# Django: settings.py
ESCALATED = { 'MODE': 'self-hosted' }
```

```ruby
# Rails: config/initializers/escalated.rb
config.mode = :self_hosted
```

```typescript
// AdonisJS: config/escalated.ts
mode: 'self-hosted',
```

```elixir
# Phoenix: config/config.exs
config :escalated, mode: :self_hosted
```

## Driver Pattern

The driver pattern is the core abstraction that makes hosting modes work. Each framework defines a `TicketDriver` interface (or equivalent) with methods for every ticket operation:

```php
// PHP (Laravel) - Contracts/TicketDriver.php
interface TicketDriver
{
    public function createTicket(Ticketable $requester, array $data): Ticket;
    public function updateTicket(Ticket $ticket, array $data): Ticket;
    public function transitionStatus(Ticket $ticket, TicketStatus $status, ?Ticketable $causer = null): Ticket;
    public function assignTicket(Ticket $ticket, int $agentId, ?Ticketable $causer = null): Ticket;
    public function unassignTicket(Ticket $ticket, ?Ticketable $causer = null): Ticket;
    public function addReply(Ticket $ticket, Ticketable $author, string $body, bool $isNote = false, array $attachments = []): Reply;
    public function getTicket(int|string $id): Ticket;
    public function listTickets(array $filters = [], ?Ticketable $for = null): LengthAwarePaginator;
    public function addTags(Ticket $ticket, array $tagIds, ?Ticketable $causer = null): Ticket;
    public function removeTags(Ticket $ticket, array $tagIds, ?Ticketable $causer = null): Ticket;
    public function changeDepartment(Ticket $ticket, int $departmentId, ?Ticketable $causer = null): Ticket;
    public function changePriority(Ticket $ticket, TicketPriority $priority, ?Ticketable $causer = null): Ticket;
}
```

Three implementations exist:

| Driver | Class | Behavior |
|--------|-------|----------|
| `LocalDriver` | `Drivers/LocalDriver` | Direct DB queries via the ORM |
| `SyncedDriver` | `Drivers/SyncedDriver` | Local DB + async sync to cloud |
| `CloudDriver` | `Drivers/CloudDriver` | HTTP proxy to cloud.escalated.dev |

The active driver is resolved from config at boot. All services and controllers depend on the `TicketDriver` interface, never a concrete driver.

## Service Layer

Business logic lives in dedicated service classes, not in controllers or models. This pattern is consistent across all frameworks:

| Service | Responsibility |
|---------|---------------|
| `TicketService` | Ticket CRUD, status transitions, filtering |
| `AssignmentService` | Agent assignment, round-robin, capacity-based routing |
| `SlaService` | SLA policy evaluation, breach detection, business hours |
| `EscalationService` | Rule evaluation, automatic escalation actions |
| `NotificationService` | Email dispatch, webhook delivery |
| `AttachmentService` | File upload, storage, validation |
| `MacroService` | Macro execution (batch actions on tickets) |
| `ReportingService` | Metrics, aggregations, dashboard data |
| `PluginService` | Plugin lifecycle, hook dispatch to runtime |
| `InboundEmailService` | Email parsing (Mailgun, Postmark, SES, IMAP) |
| `ImportService` | Data import from Zendesk, Freshdesk, Intercom, Help Scout |
| `SkillRoutingService` | Skill-based ticket routing |
| `CapacityService` | Agent workload and capacity tracking |
| `WebhookDispatcher` | Outbound webhook delivery with retries |
| `AutomationRunner` | Trigger-based automation execution |
| `BusinessHoursCalculator` | Business hours and holiday-aware time calculations |
| `HookRegistry` | Plugin hook registration and dispatch |
| `TicketSplitService` | Split a reply into a new linked ticket |
| `SnoozeService` | Snooze/wake ticket scheduling |
| `SavedViewService` | CRUD for saved filter views |
| `WidgetService` | Widget API (KB search, ticket creation, status lookup) |
| `BroadcastService` | Real-time event broadcasting dispatch |
| `EmailBrandingService` | Branded email template rendering |

Controllers are thin -- they validate input, call a service, and return a response.

## UI-Optional Pattern

Every framework package supports running in **headless mode** (no UI). When `ui_enabled` is `false`, only the backend is active: API routes, commands, events, migrations, and the plugin runtime.

The UI abstraction is the `EscalatedUiRenderer` interface:

```php
// PHP (Laravel)
interface EscalatedUiRenderer
{
    public function render(string $page, array $props = []): mixed;
}
```

The default implementation (`InertiaUiRenderer`) delegates to Inertia.js, which renders Vue 3 components from the shared `@escalated-dev/escalated` npm package. Teams can swap in their own renderer (Blade, Livewire, etc.) by binding a different implementation.

Equivalent abstractions exist in other frameworks:
- **Django**: `render_page(request, page, props)` function
- **Rails**: `Escalated::UiRenderer` module
- **AdonisJS**: `EscalatedRenderer` class
- **Phoenix**: `Escalated.Renderer` behaviour
- **Go**: `renderer.Render(w, r, page, props)` function

The shared frontend (`@escalated-dev/escalated`) provides Vue 3 pages and components:
- `pages/Agent/*` -- Agent dashboard, ticket list, ticket detail
- `pages/Customer/*` -- Customer portal, ticket submission
- `pages/Admin/*` -- Admin settings, departments, SLA, rules
- `components/*` -- Reusable ticket components, editors, filters

## Plugin System

The plugin system is a three-layer architecture:

### Layer 1: Plugin SDK (`@escalated-dev/plugin-sdk`)

TypeScript SDK for authoring plugins. Provides `definePlugin()` with support for:

- **Actions** -- Fire-and-forget event handlers (`ticket.created`, `ticket.resolved`, etc.)
- **Filters** -- Transform data passing through hooks (must return modified value)
- **Endpoints** -- Custom REST routes exposed by the plugin
- **Webhooks** -- Incoming webhook handlers
- **Cron** -- Scheduled tasks (cron expressions)
- **Pages** -- Full-page UI routes in the admin/agent/customer areas
- **Components** -- UI components injected into existing page slots
- **Widgets** -- Dashboard widgets with optional badge counts
- **Config** -- Admin-configurable settings (text, password, select, etc.)
- **Lifecycle** -- `onActivate` / `onDeactivate` hooks

Every handler receives a `PluginContext` (`ctx`) with:

| Property | Purpose |
|----------|---------|
| `ctx.config` | Read/write plugin config values |
| `ctx.store` | Persistent key-value and query store |
| `ctx.http` | Outbound HTTP client |
| `ctx.broadcast` | Real-time event broadcasting |
| `ctx.log` | Structured logging |
| `ctx.tickets` | Ticket CRUD repository |
| `ctx.replies` | Reply repository |
| `ctx.contacts` | Contact lookup/creation |
| `ctx.tags` | Tag management |
| `ctx.departments` | Department lookup |
| `ctx.agents` | Agent lookup |
| `ctx.emit` | Emit custom hooks |
| `ctx.currentUser` | Current authenticated user |

### Layer 2: Plugin Runtime (`@escalated-dev/plugin-runtime`)

A long-lived Node.js process that:

1. Discovers installed plugins from `node_modules/@escalated-dev/plugin-*`
2. Responds to JSON-RPC 2.0 messages from the host framework
3. Routes hooks (actions, filters) to registered plugin handlers
4. Proxies `ctx.*` calls back to the host for data operations

### Layer 3: Framework Bridge

Each backend framework has a bridge that:

1. Spawns the plugin runtime as a child process
2. Sends hook dispatches over stdin (JSON-RPC 2.0)
3. Receives and responds to `ctx.*` calls from plugins
4. Handles runtime lifecycle (lazy spawn, restart on crash, exponential backoff)

```
Host Framework (PHP/Ruby/Python)         Plugin Runtime (Node.js)
┌──────────────────────────┐   stdio    ┌──────────────────────────┐
│  Bridge                  │<---------->│  @escalated-dev/          │
│  - spawns subprocess     │  JSON-     │    plugin-runtime         │
│  - dispatches hooks      │  RPC 2.0  │  ┌────────────────────┐   │
│  - handles ctx.* calls   │           │  │ plugin-slack        │   │
│                          │           │  │ plugin-jira         │   │
│                          │           │  │ your-custom-plugin  │   │
└──────────────────────────┘           │  └────────────────────┘   │
                                       └──────────────────────────┘
```

Resilience guarantees:
- Runtime spawned lazily on first hook dispatch
- Automatic restart with exponential backoff on crash
- Action hooks degrade gracefully when runtime unavailable
- Filter hooks return unmodified values when runtime is down

### Official Plugins

The `escalated-plugins` monorepo contains all official plugins, each as a pair: an SDK plugin (`plugin-*-sdk`) and a metadata/README package (`plugin-*`):

- AI Copilot, Approvals, Community, Compliance, Custom Layouts, Custom Objects
- Import tools (Zendesk, Freshdesk, Intercom, Help Scout)
- Integrations (Slack, Jira, WhatsApp, Social, Phone, SMS)
- Channels (Live Chat, Web Widget, Proactive Messages)
- Utilities (IP Restriction, NPS, Scheduled Reports, Omnichannel Routing, Unified Status, Mobile SDK, Marketplace)

## Event-Driven Architecture

Every significant action dispatches an event. Events are consumed by:

1. **Internal listeners** -- Update SLA timers, trigger escalation checks, send notifications
2. **Plugin hooks** -- Forwarded to the plugin runtime for any registered action/filter handlers
3. **Webhooks** -- Outbound HTTP calls to configured URLs with signed payloads
4. **Sync events** -- In synced mode, replicated to the cloud API

Core events include:
- `ticket.created`, `ticket.updated`, `ticket.status_changed`
- `ticket.assigned`, `ticket.unassigned`, `ticket.escalated`
- `ticket.priority_changed`, `ticket.department_changed`
- `ticket.tagged`, `ticket.untagged`, `ticket.merged`
- `ticket.split` (new -- when a reply is split into a new ticket)
- `ticket.snoozed`, `ticket.unsnoozed` (new -- snooze lifecycle)
- `reply.created`, `reply.updated`
- `sla.breached`, `sla.warning`
- `agent.online`, `agent.offline`
- `rating.submitted`

## Cloud API Architecture

The Escalated Cloud (`cloud.escalated.dev`) provides:

- **REST API** (`/api/v1`) -- Full CRUD for tickets, replies, departments, tags, SLA policies
- **Multi-tenant** -- Each connected app is a tenant with isolated data
- **API key auth** -- Bearer tokens with per-key scoped abilities
- **Webhook delivery** -- Outbound webhooks for cloud events
- **Cross-app reporting** -- Unified dashboard across all connected apps
- **SSO** -- Single sign-on across cloud-connected instances

The Cloud API mirrors the `TicketDriver` interface so that `CloudDriver` implementations can proxy calls directly.

## Marketplace Architecture

The plugin marketplace (`marketplace.escalated.dev`) is the distribution channel for plugins:

- **Plugin registry** -- Metadata, versions, compatibility matrices
- **Installation** -- `npm install @escalated-dev/plugin-{name}` + activate in admin UI
- **Configuration** -- Per-plugin admin settings defined in plugin `config` schema
- **Versioning** -- Semver with framework compatibility constraints
- **Categories** -- Integrations, Channels, Automation, Analytics, Import, Utilities

## Data Model (Core)

The following tables are created by every framework package (prefixed with `escalated_`):

| Table | Purpose |
|-------|---------|
| `escalated_tickets` | Core ticket records |
| `escalated_replies` | Ticket replies (public, internal notes, system) |
| `escalated_departments` | Department/team organization |
| `escalated_tags` | Ticket categorization tags |
| `escalated_ticket_tag` | Pivot: tickets <-> tags |
| `escalated_sla_policies` | SLA definitions with per-priority targets |
| `escalated_escalation_rules` | Condition-based automation rules |
| `escalated_ticket_activities` | Audit log of every ticket action |
| `escalated_attachments` | File attachments on tickets/replies |
| `escalated_canned_responses` | Pre-written response templates |
| `escalated_macros` | Batch action definitions |
| `escalated_settings` | Key-value app settings |
| `escalated_api_tokens` | Bearer tokens for the REST API |
| `escalated_inbound_emails` | Processed inbound email records |
| `escalated_satisfaction_ratings` | CSAT ratings |
| `escalated_plugins` | Installed plugin registry |
| `escalated_plugin_store` | Per-plugin persistent key-value storage |
| `escalated_custom_fields` | Custom field definitions |
| `escalated_custom_field_values` | Custom field values on tickets |
| `escalated_ticket_statuses` | Custom status definitions |
| `escalated_business_schedules` | Business hours schedules |
| `escalated_holidays` | Holiday definitions |
| `escalated_roles` | Role definitions |
| `escalated_audit_logs` | System-wide audit log |
| `escalated_ticket_links` | Links between tickets |
| `escalated_side_conversations` | Side conversations on tickets |
| `escalated_agent_profiles` | Extended agent data (skills, capacity) |
| `escalated_skills` | Skill definitions for routing |
| `escalated_agent_capacity` | Agent workload tracking |
| `escalated_webhooks` | Outbound webhook configurations |
| `escalated_automations` | Trigger-based automation definitions |
| `escalated_articles` | Knowledge base articles |
| `escalated_article_categories` | Article categorization |
| `escalated_import_jobs` | Data import job tracking |
| `escalated_custom_objects` | Custom object schemas |
| `escalated_custom_object_records` | Custom object data |
| `escalated_saved_views` | Saved filter presets (personal or shared) |
| `escalated_widget_configs` | Embeddable widget configuration |

## Real-time Broadcasting Architecture

Escalated supports real-time event broadcasting as an opt-in feature. When enabled, core domain events are pushed to connected clients via WebSocket (or SSE, depending on framework).

### How It Works

1. A domain event fires (e.g., `TicketCreated`, `ReplyCreated`, `TicketAssigned`)
2. The `BroadcastService` checks if broadcasting is enabled in config
3. If enabled, the event is serialized and pushed to the appropriate channel/topic
4. The frontend `useRealtime` composable receives the event and updates the UI

### Framework-Specific Transports

| Framework | Transport | Library |
|-----------|-----------|---------|
| Laravel | WebSocket (Pusher/Ably/Reverb) | Laravel Broadcasting + Echo |
| Rails | WebSocket | ActionCable |
| Django | WebSocket | Django Channels |
| AdonisJS | SSE | AdonisJS Transmit |
| Symfony | SSE | Mercure |
| Phoenix | WebSocket | Phoenix Channels / PubSub |
| Go | SSE | Custom goroutine-based broadcaster |

### Channel Structure

- `department.{id}` -- All tickets in a department
- `ticket.{id}` -- Single ticket updates (replies, status changes)
- `agent.{id}` -- Personal agent notifications (assignments, escalations)

### Frontend Integration

The `useRealtime` composable in `@escalated-dev/escalated` provides a unified API. It auto-detects whether Laravel Echo is available and falls back to HTTP polling when WebSocket/SSE is not configured:

```typescript
const { subscribe } = useRealtime()
subscribe(`ticket.${id}`, 'ReplyCreated', (event) => { /* update UI */ })
```

### Graceful Degradation

Broadcasting is fully opt-in. When disabled:
- No WebSocket/SSE connections are established
- The frontend composable silently falls back to periodic polling
- Zero performance impact on the backend

## Embeddable Widget API

The embeddable support widget allows customers to embed a lightweight support interface on their websites. The widget is a standalone JS bundle built from the `@escalated-dev/escalated` package.

### Widget Endpoints

Each backend framework exposes widget API endpoints (unauthenticated, rate-limited; cross-origin only for allow-listed sites, see below):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/support/widget/config` | GET | Widget configuration (colors, greeting, departments) |
| `/support/widget/articles/search` | GET | Knowledge base article search |
| `/support/widget/tickets` | POST | Submit a new ticket |
| `/support/widget/tickets/status` | GET | Look up ticket status by email + ticket number |

### Widget Configuration

Admins configure the widget via admin settings:
- **Accent color** -- Primary brand color
- **Position** -- Bottom-left or bottom-right
- **Greeting message** -- Welcome text shown in the widget
- **Departments** -- Which departments are available for ticket submission
- **KB search** -- Whether to show KB search in the widget

### Embedding

```html
<script src="https://your-app.com/support/widget/embed.js" async></script>
```

The script is the standalone bundle (`@escalated-dev/escalated/widget`,
`dist/widget/escalated-widget.js`). Loaded from `{widgetPath}/embed.js` it finds
its backend from its own URL. It renders a floating launcher, or with
`data-mode="inline" data-target="#el"` an on-page support form. Host parameters
(`data-tabs`, `data-department`, `data-lock-department`, visitor prefill,
`data-meta-*` metadata, ...) and the `window.EscalatedWidget` JS API are
documented in the frontend repo's `docs/embedding-the-widget.md`.

### Embedding on other sites (cross-origin contract)

Embedding on a site other than the backend's own is opt-in per origin. A
backend that supports it:

- keeps an allow list of bare origins (`scheme://host[:port]`, optional
  `https://*.example.com` subdomain wildcard, never a bare `*`), from config
  and an admin setting `widget_allowed_origins`;
- answers preflights from listed origins (`GET, POST, OPTIONS`; headers
  `Accept, Authorization, Content-Type, X-Requested-With`) and adds
  `Access-Control-Allow-Origin: <origin>` + `Vary: Origin` to every widget
  response for them, including 422 and 429;
- skips CSRF for listed origins and treats those requests as guests even when
  the browser has a signed-in session (credentials are never allowed);
- handles every other request exactly as before;
- serves the bundle at `{widgetPath}/embed.js`;
- returns `accepts_metadata: true` from `/config` when it stores host
  `metadata` on widget tickets/chats as a sanitised flat map with a
  server-recorded `embedded_on` origin. The widget sends `metadata` only then.

Implemented in: Laravel (1.9.4). Other backends: not yet; the widget still
works same-origin there and never sends `metadata` to them.

#### Parity status (surveyed 2026-10-19 from each repo's default branch)

| Backend | CSRF on widget POSTs today | CORS today | `/config` | Host `metadata` stored | Gap to the contract |
|---|---|---|---|---|---|
| laravel | host CSRF; skipped for listed origins | allow list (config + setting) | yes, `accepts_metadata` | yes (sanitised) | none |
| nestjs | none (JSON) | unused `widgetOrigins` option | **missing** | no | `/config`, CORS, metadata, `embed.js` |
| rails | `protect_from_forgery with: :null_session` | none | yes | fixed `{source:'widget'}` | CORS, metadata, `embed.js` |
| django | `@csrf_exempt` | none | yes | chat only, unsanitised | CORS, ticket metadata + sanitising, `embed.js` |
| adonis | host `shield` may apply | none | yes | chat only, unsanitised | CSRF exemption for listed origins, CORS, metadata, `embed.js` |
| symfony | none | **echoes any `Origin`**; empty list allows all | yes | body passed to chat | allow-list check on every route, settings-backed list, metadata, `embed.js` |
| wordpress | none (no cookie nonce) | none | yes | no | CORS, metadata, `embed.js` |
| phoenix | host `:protect_from_forgery` (README mounts in `:browser`) | none | yes (app config) | no | CSRF exemption for listed origins, CORS, metadata, `embed.js` |
| go | none | **`AllowedOrigins` string written to ACAO, default `*`** | yes | no | per-origin matching, metadata, `embed.js` |
| dotnet | none | none | **missing** | no | `/config`, CORS, metadata, `embed.js` |
| spring | `csrf.disable()` | none | **missing** | no | `/config`, CORS, metadata, `embed.js` |

None of the other backends exposes the `/verification` endpoint the shared
widget uses when `/config` returns `guest_verification_required: true`; that
predates embedding and is tracked with verified guest access.


## Email Threading System

Outbound notification emails now include proper email threading headers so replies thread correctly in email clients (Gmail, Outlook, Apple Mail, etc.).

### Headers

- **Message-ID** -- Unique identifier for each outbound email, stored in `escalated_replies.message_id`
- **In-Reply-To** -- References the previous email in the thread (the message being replied to)
- **References** -- Full chain of Message-IDs in the conversation thread

### Branded Templates

All notification emails use branded HTML templates. Admins can configure:
- **Logo URL** -- Displayed in the email header
- **Accent color** -- Used for buttons and highlights
- **Footer text** -- Custom footer (company name, unsubscribe links, etc.)

Templates are rendered by each framework's native templating engine (Blade, Jinja2, ERB, Edge, Twig, EEx, Go html/template).
