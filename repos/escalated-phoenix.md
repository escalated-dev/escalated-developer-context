# escalated-phoenix

**Language**: Elixir | **Framework**: Phoenix | **Package**: Hex

Phoenix implementation of Escalated. Installed as a Hex dependency.

## Installation

```elixir
# mix.exs
def deps do
  [{:escalated_phoenix, "~> 0.1.0"}]
end
```

Configure in `config/config.exs`, run `mix ecto.migrate`.

## Configuration

```elixir
config :escalated,
  repo: MyApp.Repo,
  user_schema: MyApp.Accounts.User,
  route_prefix: "/support",
  table_prefix: "escalated_",
  ui_enabled: true,
  api_enabled: false,
  admin_check: &MyApp.Accounts.admin?/1,
  agent_check: &MyApp.Accounts.agent?/1,
  default_priority: :medium,
  allow_customer_close: true,
  sla: %{
    enabled: true,
    business_hours_only: false,
    business_hours: %{start: ~T[09:00:00], end: ~T[17:00:00], timezone: "UTC", days: [1,2,3,4,5]}
  }
```

## Directory Structure

```
lib/
├── escalated/
│   ├── tickets.ex           # Tickets context (create, update, list, etc.)
│   ├── departments.ex       # Departments context
│   ├── sla.ex               # SLA context
│   ├── schemas/             # Ecto schemas (Ticket, Reply, Department, etc.)
│   ├── services/            # Service modules
│   ├── drivers/             # LocalDriver, SyncedDriver, CloudDriver
│   └── bridge/              # Plugin runtime bridge
├── escalated_web/
│   ├── controllers/         # Phoenix controllers grouped by role
│   ├── router.ex            # Router macro
│   └── plugs/               # Auth plugs

config/                      # Config templates
priv/
└── repo/migrations/         # Ecto migrations

test/                        # ExUnit tests
```

## Routes

Uses a Phoenix router macro:

```elixir
# In your router
use Escalated.Router
escalated_routes "/support"
```

## Authorization

`Escalated.Permissions` applies strict boolean `admin_check`/`agent_check`
callbacks consistently across routes, APIs and channels. Without callbacks,
single-tenant access uses host flags or active profiles. Merchant mode also
requires current membership and uses tenant-local staff profiles instead of
host-wide flags. Requester access checks both requester ID and type.

### Merchant tenancy and verified guests

The September 30, 2026 source implementation adds `tenant_id` to package data,
scoped reads/writes/associations, private guest attachments, expiring encrypted
mailbox-verified grants, and host-supplied tracking-reference lookup. Legacy rows
stay in the reserved empty namespace until explicitly assigned. Jobs use an
explicit tenant or trusted catalog, and realtime topics are partitioned.

Enable only after applying all migrations and configuring the host contracts in
the [merchant and guest runbook](https://github.com/escalated-dev/escalated-phoenix/blob/master/docs/merchant-and-guest-access.md).
Provision staff seats separately from host membership. Merchant guest chat uses
HTTP polling; the optional shared frontend realtime client requires a host
Echo-to-Phoenix bridge. Generic platform plugins and host-global role mutation
are disabled in tenant mode. This source status is not a Hex release or deployed
configuration; see [integration readiness](../guides/integration-readiness.md).

## UI Rendering

Uses the optional `inertia` package through
`Escalated.Rendering.UIRenderer`. Disable with `ui_enabled: false` for JSON.
The shared general Settings form advertises only Phoenix's implemented fields.

## Running Tests

```bash
mix test
```

Uses ExUnit with Ecto sandbox. SQLite is the default; CI also runs PostgreSQL and
MySQL via `ESCALATED_TEST_ADAPTER`. A separate host repository exercises the
support/host connection boundary. The `mix test` alias drops and recreates the
configured test database, so use disposable test targets only.

After each engine's suite, CI runs `scripts/verify_tenancy_migrations.exs` in a
separate disposable database. It checks populated upgrades, tenant-local unique
keys, case-sensitive IDs, clean downgrades and rollback refusal for guest state
or assigned merchant rows.

## New Features

### Ticket Splitting

`Escalated.Tickets.split_reply/2` splits a reply into a new linked ticket. Creates a `TicketLink` record and copies metadata.

### Ticket Snooze / Schedule

A `snoozed_until` field on the `Ticket` schema tracks snooze times. Snoozed tickets are excluded from default queries. A Mix task wakes expired snoozes:

```bash
mix escalated.wake_snoozed_tickets
```

Should be scheduled via cron or a process like Quantum.

### Email Threading and Branded Templates

Outbound emails include `In-Reply-To`, `References`, and `Message-ID` headers. Email templates (via Swoosh/Bamboo) use branded HTML with configurable logo, accent color, and footer.

### Saved Views / Custom Queues

`Escalated.SavedViews` context and `SavedViewController` allow agents to save/recall named filter presets (personal or shared).

### Embeddable Support Widget

`WidgetController` provides API endpoints for the embeddable widget. Configured via admin settings.

### Knowledge Base Toggle Settings

KB visibility, public/private access, and feedback are controlled via settings. Plugs guard KB routes and return 404 when disabled.

### Real-time Broadcasting

Core events are broadcast via Phoenix Channels / PubSub when `broadcasting_enabled: true`:

- `ticket:created`, `ticket:status_changed` -- ticket and all-ticket topics
- `ticket:reply_added` -- ticket topics, with internal-note metadata withheld from customers
- `ticket:assigned` -- ticket and agent topics

Configuration:

```elixir
config :escalated,
  broadcasting_enabled: true,
  pubsub_server: MyApp.PubSub
```

### New Migrations

- Add `snoozed_until` to `escalated_tickets`
- Add `message_id` to `escalated_replies`
- Create `escalated_saved_views`
- Create `escalated_widget_configs`

## CI/CD

- **Linting**: Credo + `mix format`, enforced via GitHub Actions on every push and PR.
