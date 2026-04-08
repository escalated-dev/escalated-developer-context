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

Configured via function references (`admin_check`, `agent_check`). Enforced through Phoenix Plugs.

## UI Rendering

Uses the `inertia_phoenix` library. The `Escalated.Renderer` behaviour abstracts page rendering. Disable with `ui_enabled: false`.

## Running Tests

```bash
mix test
```

Uses ExUnit with Ecto sandbox (PostgreSQL).

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

Core events are broadcast via Phoenix Channels / PubSub when `broadcasting: true`:

- `TicketCreated`, `TicketUpdated` -- broadcast to department/agent topics
- `ReplyCreated` -- broadcast to the ticket topic
- `TicketAssigned`, `TicketEscalated` -- broadcast to agent topics

Configuration:

```elixir
config :escalated,
  broadcasting: true,
  pubsub_server: MyApp.PubSub
```

### New Migrations

- Add `snoozed_until` to `escalated_tickets`
- Add `message_id` to `escalated_replies`
- Create `escalated_saved_views`
- Create `escalated_widget_configs`

## CI/CD

- **Linting**: Credo + `mix format`, enforced via GitHub Actions on every push and PR.
