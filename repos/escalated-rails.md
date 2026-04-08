# escalated-rails

[![Tests](https://github.com/escalated-dev/escalated-rails/actions/workflows/run-tests.yml/badge.svg)](https://github.com/escalated-dev/escalated-rails/actions/workflows/run-tests.yml)

**Language**: Ruby | **Framework**: Rails 7.1+ | **Package**: Gem (engine)

Rails engine implementation of Escalated. Mountable as a Rails engine via Bundler.

## Installation

```bash
bundle add escalated
npm install @escalated-dev/escalated
rails generate escalated:install
rails db:migrate
```

## Directory Structure

```
app/
├── controllers/escalated/     # Controllers grouped by role
│   ├── admin/
│   ├── agent/
│   ├── api/
│   ├── customer/
│   └── guest/
├── models/escalated/          # ActiveRecord models
├── services/escalated/        # Service objects
├── views/escalated/           # ERB views (minimal -- Inertia handles UI)
├── jobs/escalated/            # ActiveJob classes
└── mailers/escalated/         # ActionMailer classes

config/
├── routes.rb                  # Engine route definitions

db/
├── migrate/                   # Migrations

lib/
├── escalated/
│   ├── engine.rb              # Rails engine definition
│   ├── configuration.rb       # Config DSL
│   ├── drivers/               # LocalDriver, SyncedDriver, CloudDriver
│   ├── bridge/                # Plugin runtime bridge
│   └── ui_renderer.rb         # UI rendering abstraction

spec/                          # RSpec tests
stubs/                         # Generator templates
```

## Configuration

```ruby
# config/initializers/escalated.rb
Escalated.configure do |config|
  config.mode = :self_hosted
  config.admin_check = ->(user) { user.admin? }
  config.agent_check = ->(user) { user.agent? || user.admin? }
  config.route_prefix = 'support'
  config.ui_enabled = true
end
```

## Routes

The engine is mounted in the host app's routes:

```ruby
# config/routes.rb
mount Escalated::Engine, at: '/support'
```

## Authorization

Configured via lambdas in the initializer (`admin_check`, `agent_check`). The `Ticketable` concern is mixed into the User model.

## UI Rendering

Uses `inertia_rails` gem. The `Escalated::UiRenderer` module abstracts page rendering. Disable UI with `config.ui_enabled = false`.

## Running Tests

```bash
bundle exec rspec
```

Uses RSpec with FactoryBot and SQLite in-memory.

## New Features

### Ticket Splitting

`Escalated::TicketSplitService` splits a reply into a new linked ticket. Creates a `TicketLink` record and copies metadata (tags, department, priority).

### Ticket Snooze / Schedule

Agents can snooze tickets until a future date. A `snoozed_until` column on `escalated_tickets` tracks the snooze time. Snoozed tickets are excluded from default scopes. A Rake task wakes expired snoozes:

```bash
rails escalated:wake_snoozed_tickets
```

This task should be scheduled via cron or a scheduler like `whenever` / `solid_queue`.

### Email Threading and Branded Templates

Outbound emails include `In-Reply-To`, `References`, and `Message-ID` headers for proper email client threading. ActionMailer templates use branded HTML layouts with configurable logo, accent color, and footer text via `escalated_settings`.

### Saved Views / Custom Queues

`Escalated::SavedView` model and `Escalated::SavedViewsController` allow agents to save and recall named filter presets (personal or shared).

### Embeddable Support Widget

`Escalated::WidgetController` provides API endpoints for the embeddable JS widget (KB search, ticket creation, ticket status lookup). Widget appearance and behavior are configurable in admin settings.

### Knowledge Base Toggle Settings

KB can be enabled/disabled, set to public or private, and article feedback can be toggled. Routes are guarded via a `before_action` that checks these settings.

### Real-time Broadcasting

Core events are broadcast via ActionCable when `broadcasting.enabled` is `true`:

- `TicketCreatedJob`, `TicketUpdatedJob` -- broadcast to department/agent channels
- `ReplyCreatedJob` -- broadcast to the ticket channel
- `TicketAssignedJob`, `TicketEscalatedJob` -- broadcast to relevant agents

Broadcasting is opt-in. When disabled, no ActionCable channels are registered.

### New Migrations

- Add `snoozed_until` to `escalated_tickets`
- Add `message_id` to `escalated_replies`
- Create `escalated_saved_views`
- Create `escalated_widget_configs`

## CI/CD

- **Linting**: RuboCop, enforced via GitHub Actions on every push and PR.
