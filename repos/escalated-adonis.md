# escalated-adonis

[![Tests](https://github.com/escalated-dev/escalated-adonis/actions/workflows/run-tests.yml/badge.svg)](https://github.com/escalated-dev/escalated-adonis/actions/workflows/run-tests.yml)

**Language**: TypeScript | **Framework**: AdonisJS v6 | **Package**: npm

AdonisJS v6 implementation of Escalated. Installed as an npm package and configured via `node ace configure`.

## Installation

```bash
npm install @escalated-dev/escalated-adonis
node ace configure @escalated-dev/escalated-adonis
node ace migration:run
```

The configure command publishes `config/escalated.ts`, registers the provider, and copies migrations.

## Requirements

- AdonisJS v6 (Core ^6.0)
- @adonisjs/lucid ^21.0 (ORM)
- @adonisjs/auth ^9.0 (authentication)
- @adonisjs/inertia ^1.0 (UI rendering)
- @adonisjs/drive ^3.0 (file attachments)
- @adonisjs/mail ^9.0 (optional, for notifications)
- Node.js 20+

## Directory Structure

```
src/
├── controllers/            # Controllers grouped by role
│   ├── admin/
│   ├── agent/
│   ├── api/
│   ├── customer/
│   └── guest/
├── models/                 # Lucid ORM models
├── services/               # Service classes
├── drivers/                # LocalDriver, SyncedDriver, CloudDriver
├── bridge/                 # Plugin runtime bridge
├── middleware/             # Auth middleware
├── validators/             # VineJS validators
└── events/                 # Event classes

config/
└── escalated.ts            # Published to host app

database/
└── migrations/             # Lucid migrations (copied to host app)

providers/
└── escalated_provider.ts   # AdonisJS service provider

start/
└── routes.ts               # Route definitions

resources/                  # Edge views (minimal -- Inertia handles UI)
tests/                      # Japa tests
```

## Configuration

```typescript
// config/escalated.ts
const escalatedConfig: EscalatedConfig = {
  mode: 'self-hosted',
  userModel: '#models/user',
  routes: {
    enabled: true,
    prefix: 'support',
    middleware: ['auth'],
    adminMiddleware: ['auth'],
  },
  ui: { enabled: true },
  tickets: {
    allowCustomerClose: true,
    defaultPriority: 'medium',
  },
  sla: { enabled: true },
}
```

## Routes

Routes are registered by the provider under the configured prefix. Grouped by role (customer, agent, admin, API, guest).

## Authorization

Configured via callables in the config:

```typescript
adminCheck: (user) => user.isAdmin,
agentCheck: (user) => user.isAgent || user.isAdmin,
```

Uses AdonisJS Bouncer for fine-grained authorization.

## UI Rendering

Uses `@adonisjs/inertia`. The `EscalatedRenderer` class abstracts page rendering. Disable UI with `ui.enabled = false`.

## Running Tests

```bash
node ace test
```

Uses Japa with SQLite in-memory.

## New Features

### Ticket Splitting

`TicketSplitService` splits a reply into a new linked ticket with copied metadata (tags, department, priority).

### Ticket Snooze / Schedule

A `snoozedUntil` column on tickets tracks snooze times. Snoozed tickets are excluded from default queries. An Ace command wakes expired snoozes:

```bash
node ace escalated:wake-snoozed-tickets
```

Should be scheduled via the AdonisJS scheduler or cron.

### Email Threading and Branded Templates

Outbound emails include `In-Reply-To`, `References`, and `Message-ID` headers. Email templates use branded HTML with configurable logo, accent color, and footer via admin settings.

### Saved Views / Custom Queues

`SavedView` Lucid model and `SavedViewController` allow agents to save/recall named filter presets (personal or shared).

### Embeddable Support Widget

`WidgetController` provides API endpoints for the embeddable widget. Configured via admin settings.

### Knowledge Base Toggle Settings

KB can be enabled/disabled, set to public/private, and article feedback can be toggled. Middleware guards KB routes.

### Real-time Broadcasting

Core events are broadcast via AdonisJS Transmit when `broadcasting.enabled` is `true`:

- `TicketCreated`, `TicketUpdated` -- broadcast to department/agent channels
- `ReplyCreated` -- broadcast to the ticket channel
- `TicketAssigned`, `TicketEscalated` -- broadcast to relevant agents

Configuration in `config/escalated.ts`:

```typescript
broadcasting: {
  enabled: true,
  driver: 'transmit', // AdonisJS Transmit (SSE-based)
},
```

### New Migrations

- Add `snoozed_until` to `escalated_tickets`
- Add `message_id` to `escalated_replies`
- Create `escalated_saved_views`
- Create `escalated_widget_configs`

## CI/CD

- **Linting**: ESLint + Prettier, enforced via GitHub Actions on every push and PR.
