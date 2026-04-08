# escalated-go

**Language**: Go | **Framework**: net/http, Chi | **Package**: Go module

Go implementation of Escalated. Framework-agnostic -- works with standard `net/http`, Chi, and any router that accepts `http.HandlerFunc`.

## Installation

```bash
go get github.com/escalated-dev/escalated-go
```

## Features

- Tickets with statuses, priorities, types, and SLA tracking
- Replies (public, internal notes, system messages)
- Departments and tags
- SLA policies with per-priority response/resolution targets
- Agent dashboard and admin configuration
- Inertia.js UI or headless JSON API mode
- PostgreSQL and SQLite support
- Embedded SQL migrations

## Directory Structure

```
escalated.go                # Main package entry
config.go                   # Configuration struct and defaults

handlers/                   # HTTP handlers grouped by role
├── admin.go
├── agent.go
├── api.go
├── customer.go
└── guest.go

middleware/                 # Auth and rate limiting middleware

migrations/                 # Embedded SQL migrations
├── migrate.go
└── *.sql

models/                     # Data structures

renderer/                   # UI rendering abstraction
├── renderer.go             # Interface
└── inertia.go              # Inertia.js implementation

router/                     # Route registration
└── router.go               # Chi router setup

services/                   # Business logic services

store/                      # Database layer (PostgreSQL, SQLite)
```

## Configuration

```go
cfg := escalated.DefaultConfig()
cfg.DB = db
cfg.RoutePrefix = "/support"
cfg.AdminCheck = func(r *http.Request) bool {
    return r.Header.Get("X-Admin") == "true"
}
cfg.AgentCheck = func(r *http.Request) bool {
    return r.Header.Get("X-Agent") == "true"
}
```

## Routes

Routes are registered via the router package, which returns an `http.Handler` mountable on any mux:

```go
r := chi.NewRouter()
r.Mount("/support", router.New(cfg))
```

## UI Rendering

The `renderer.Render(w, r, page, props)` function abstracts page rendering. The default implementation uses Inertia.js. Set `cfg.UIEnabled = false` for headless mode.

## Database

Supports PostgreSQL and SQLite. Migrations are embedded in the binary and run programmatically:

```go
migrations.Migrate(db, "escalated_")
```

## Running Tests

```bash
go test ./...
```

Uses Go's built-in testing package with testify assertions. SQLite in-memory for unit tests.

## New Features

### Ticket Splitting

`SplitService.SplitReply()` splits a reply into a new linked ticket. Creates a `TicketLink` record and copies metadata.

### Ticket Snooze / Schedule

A `SnoozedUntil` field on the `Ticket` model tracks snooze times. Snoozed tickets are excluded from default store queries. A CLI subcommand wakes expired snoozes:

```bash
escalated wake-snoozed-tickets
```

Can also be called programmatically via `services.WakeSnoozedTickets(db)` from a goroutine or external scheduler.

### Email Threading and Branded Templates

Outbound emails include `In-Reply-To`, `References`, and `Message-ID` headers. HTML email templates use branding settings (logo, accent color, footer) from `escalated_settings`.

### Saved Views / Custom Queues

`SavedView` model and `SavedViewHandler` provide CRUD for named filter presets (personal or shared).

### Embeddable Support Widget

`WidgetHandler` provides API endpoints for the embeddable widget (KB search, ticket creation, status lookup). Configured via admin settings.

### Knowledge Base Toggle Settings

KB visibility, public/private access, and feedback are controlled via settings. Middleware guards KB routes and returns 404 when disabled.

### Real-time Broadcasting

Core events are broadcast via Server-Sent Events (SSE) when `cfg.BroadcastingEnabled` is `true`:

- `TicketCreated`, `TicketUpdated` -- broadcast to department/agent channels
- `ReplyCreated` -- broadcast to the ticket channel
- `TicketAssigned`, `TicketEscalated` -- broadcast to relevant agents

SSE connections are managed via goroutines. A `Broadcaster` struct handles channel subscriptions and event dispatch.

```go
cfg.BroadcastingEnabled = true
```

### New Migrations

- Add `snoozed_until` to `escalated_tickets`
- Add `message_id` to `escalated_replies`
- Create `escalated_saved_views`
- Create `escalated_widget_configs`

## CI/CD

- **Linting**: golangci-lint, enforced via GitHub Actions on every push and PR.
