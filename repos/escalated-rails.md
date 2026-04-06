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
