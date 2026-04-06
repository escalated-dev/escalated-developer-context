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
