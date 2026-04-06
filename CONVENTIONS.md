# Conventions

Standards and conventions that apply across all Escalated repos.

## Code Style

| Language | Standard | Enforced By |
|----------|----------|-------------|
| PHP | PSR-12 | Laravel Pint / PHP-CS-Fixer |
| Python | PEP 8, Black formatting | Black, Ruff |
| Ruby | Standard Ruby | StandardRB |
| TypeScript | ESLint + Prettier | `eslint.config.js` + `.prettierrc` |
| Go | gofmt | `go fmt`, golangci-lint |
| Elixir | mix format | `.formatter.exs` |
| Rust | rustfmt | `rustfmt.toml` |
| Dart | dart format | `analysis_options.yaml` |

All repos run their formatter in CI. PRs that fail formatting checks are blocked.

## Naming Conventions

### Repos

- Pattern: `escalated-{framework}` for backend packages
- Plugin SDK: `escalated-plugin-sdk`
- Plugin runtime: `escalated-plugin-runtime`
- Plugins: `escalated-plugin-{name}` (with `-sdk` suffix for the SDK implementation)
- GitHub org: `escalated-dev`

### PHP (Laravel, Symfony, WordPress, Filament)

- **Namespace**: `Escalated\Laravel\`, `Escalated\Symfony\`, `Escalated\Filament\`
- **Models**: Singular PascalCase (`Ticket`, `SlaPolicy`, `EscalationRule`)
- **Services**: `{Domain}Service` (`TicketService`, `AssignmentService`)
- **Controllers**: `{Domain}Controller` grouped by role (`Agent\TicketController`, `Admin\DepartmentController`)
- **Events**: Past tense (`TicketCreated`, `StatusTransitioned`, `SlaBreached`)
- **Enums**: PascalCase (`TicketStatus`, `TicketPriority`)
- **Migrations**: `create_escalated_{table}_table`, `add_{column}_to_escalated_{table}`
- **Config keys**: snake_case (`user_model`, `ui_enabled`, `allow_customer_close`)

### Python (Django)

- **App name**: `escalated`
- **Models**: Singular PascalCase (`Ticket`, `SlaPolicy`)
- **Services**: `{domain}_service.py` with functions or classes
- **Views**: function-based or class-based, grouped by role in `views/` directory
- **Signals**: `ticket_created`, `ticket_status_changed` (snake_case)
- **Migrations**: Django auto-numbered (`0001_initial.py`, `0002_add_guest_fields.py`)
- **Settings keys**: `ESCALATED` dict with UPPER_SNAKE_CASE keys

### Ruby (Rails)

- **Module**: `Escalated`
- **Models**: Singular PascalCase (`Escalated::Ticket`, `Escalated::SlaPolicy`)
- **Services**: `{Domain}Service` in `app/services/escalated/`
- **Controllers**: namespaced under `Escalated::Agent::`, `Escalated::Admin::`, `Escalated::Customer::`
- **Concerns**: `Ticketable` mixed into the host User model
- **Migrations**: Rails-style timestamps

### TypeScript (AdonisJS, Plugin SDK, Plugin Runtime)

- **Files**: kebab-case (`ticket-service.ts`, `assignment-service.ts`)
- **Classes**: PascalCase (`TicketService`, `EscalatedProvider`)
- **Interfaces/Types**: PascalCase with descriptive names (`PluginContext`, `TicketDriver`)
- **Config**: camelCase keys in TypeScript config objects

### Go

- **Package**: `escalated`
- **Files**: snake_case (`ticket_service.go`, `sla_service.go`)
- **Types**: PascalCase exported (`Ticket`, `SlaPolicy`, `Config`)
- **Functions**: PascalCase exported, camelCase unexported
- **Handlers**: `Handle{Action}` pattern (`HandleCreateTicket`, `HandleListTickets`)

### Elixir (Phoenix)

- **Module**: `Escalated`
- **Schemas**: `Escalated.Ticket`, `Escalated.SlaPolicy`
- **Contexts**: `Escalated.Tickets`, `Escalated.Departments`
- **Functions**: snake_case (`create_ticket/2`, `transition_status/3`)

## Service Layer Pattern

All frameworks follow the same structural pattern:

1. **Controllers are thin** -- validate input, call a service, return a response.
2. **Services contain business logic** -- authorization, validation, side effects (events, notifications).
3. **Models/schemas are data containers** -- relationships, scopes/querysets, attribute casting.
4. **Drivers handle persistence** -- CRUD operations delegated through the driver interface.

```
Request -> Controller -> Service -> Driver -> Database
                          |
                          +-> Events -> Listeners
                          +-> Plugin hooks -> Runtime
```

Do NOT put business logic in controllers, middleware, or model hooks. If an operation needs to happen in multiple places (API, CLI, plugin), it belongs in a service.

## Database Conventions

### Table Prefix

All tables use the `escalated_` prefix. This prevents collisions with the host application's tables.

### Migration Naming

- Laravel: `{timestamp}_create_escalated_{table}_table.php`
- Django: auto-numbered, migration name describes the change
- Rails: `{timestamp}_create_escalated_{table}.rb`
- AdonisJS: `{timestamp}_create_escalated_{table}.ts`
- Phoenix: `{timestamp}_create_escalated_tables.exs`
- Symfony: Doctrine migrations, auto-generated
- Go: embedded SQL migrations with sequential numbering

### Soft Deletes

Tickets and replies use soft deletes (`deleted_at` column). Other records (departments, tags, SLA policies) are hard-deleted but checked for foreign key dependencies first.

### Primary Keys

All tables use auto-incrementing integer primary keys. The `tickets` table also has a human-readable `reference` column (`ESC-1`, `ESC-2`, etc.) for display.

### Timestamps

All tables include `created_at` and `updated_at` columns in UTC.

### Indexing

- `escalated_tickets`: indexed on `status`, `priority`, `assigned_agent_id`, `department_id`, `requester_id`, `created_at`
- `escalated_replies`: indexed on `ticket_id`, `created_at`
- `escalated_ticket_activities`: indexed on `ticket_id`, `created_at`
- Composite indexes on frequently filtered combinations

## Config Conventions

### Environment Variables

All env vars use the `ESCALATED_` prefix:

| Variable | Default | Purpose |
|----------|---------|---------|
| `ESCALATED_MODE` | `self-hosted` | Hosting mode |
| `ESCALATED_API_URL` | `https://cloud.escalated.dev/api/v1` | Cloud API endpoint |
| `ESCALATED_API_KEY` | -- | Cloud API key |
| `ESCALATED_UI_ENABLED` | `true` | Enable/disable built-in UI |
| `ESCALATED_USER_MODEL` | framework default | User model class/path |

### Config Files

Each framework uses its idiomatic config format:

- Laravel: `config/escalated.php`
- Django: `ESCALATED` dict in `settings.py`
- Rails: `config/initializers/escalated.rb`
- AdonisJS: `config/escalated.ts`
- Phoenix: `config :escalated` in `config/config.exs`
- Symfony: `config/packages/escalated.yaml`
- Go: `escalated.DefaultConfig()` struct
- WordPress: Settings stored in `wp_options` via admin UI

## Git Conventions

### Branch Naming

- `main` -- production-ready code
- `feat/{description}` -- new features
- `fix/{description}` -- bug fixes
- `docs/{description}` -- documentation changes
- `refactor/{description}` -- code restructuring
- `test/{description}` -- test additions/fixes
- `chore/{description}` -- maintenance tasks

### Commit Messages

Follow Conventional Commits:

```
type(scope): description

body (optional)

footer (optional)
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`, `style`

Examples:
- `feat: add skill-based routing to assignment service`
- `fix(sla): correct business hours calculation across DST`
- `docs: update plugin SDK webhook examples`
- `refactor(drivers): extract common sync logic to base class`

### PR Format

```
## Summary
- Brief description of what changed and why

## Test Plan
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing steps if applicable
```

### Commit Frequency

Commit and push frequently -- not batched. Each commit should represent a logical unit of work.

## Testing Conventions

See [TESTING.md](TESTING.md) for full details. Key rules:

- Every service method has unit tests.
- Every API endpoint has feature/integration tests.
- Every driver has integration tests.
- Plugin hooks have integration tests that verify the full dispatch chain.
- UI components have Vitest tests (not E2E for every page).
- Test files live alongside source files or in a dedicated `tests/` directory (framework-dependent).
