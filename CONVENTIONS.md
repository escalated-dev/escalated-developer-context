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

## Versioning and Releases

Every package uses semantic versioning, and in this portfolio the **patch
component carries ordinary work**:

```
1.8.0 -> 1.8.1     a fix, or a small addition        <- the usual case
1.8.1 -> 1.9.0     a substantial feature
1.9.0 -> 2.0.0     a breaking change
```

Do not reach for a minor bump simply because a change adds a public method. Most
releases across these repos are fixes and small additions, and numbering each of
them as a minor inflates the middle number until it stops meaning anything. The
version should read as "small change" unless the change is not one.

### First releases

A package that has never been published starts at `0.1.0`, whatever its
maturity. `0.x` is what tells a reader the API can still move, which is the
honest signal for something nothing has consumed yet. Reserve `1.0.0` for a
package that has users and an API you intend to keep.

### Cutting one

1. Move everything under `[Unreleased]` in `CHANGELOG.md` to a dated version
   heading, and leave `[Unreleased]` empty above it.
2. Update the version in the package manifest, where the language has one
   (`mix.exs`, `*.csproj`, `build.gradle.kts`, `package.json`, `pubspec.yaml`).
   Go has none -- the tag is the version.
3. Merge, then tag `vX.Y.Z` and cut a GitHub release from the changelog entry.

A Go tag is published permanently by the module proxy the moment it is pushed,
so it is worth being certain of the number before pushing one.

## Page Names

Backends render Inertia page names as plain strings, and the frontend package
resolves them to components. **A name with no component behind it is not an
error**: Inertia resolves it to nothing, Vue renders nothing, and the panel
comes up blank on a 200 response. It reads as a permissions problem or an empty
dataset, and no test in either repo can see it -- the backend's test asserts a
status, and the frontend's test never hears the name.

Sixty-three page names were rendering into nothing across six backends when
this was first measured. Two of them were screens that had never been built;
the rest were a backend spelling a name its own way.

### The rules

- **`@escalated-dev/escalated` is canonical.** A page name means whatever that
  package's `src/pages/**` says it means. A backend does not get to spell it
  differently.
- **`Index`, `Form`, `Show`.** One `Form` component serves create and edit, so
  there is no `New`/`Edit` pair -- that would be two names for one file.
  Framework idiom belongs in routes, not in page names.
- **Full paths, spelled out.** `Admin/KnowledgeBase/Articles/Index`, not
  `Admin/KB/Articles/Index` or `Admin/Articles/Index`.
- **Check it in CI.** The frontend publishes `pages.json`, generated from its own
  components. Each backend asserts in CI that every name it renders appears in
  that list. That comparison is the only place both halves are known.

### The guard test

Every backend has one, named for its own idiom -- `PageNameParityTest`,
`page_name_parity_test`, `Test_Page_Name_Parity`. They all do the same three
things:

1. Scan the package's own source for `Escalated/...` string literals, keeping
   the file each one came from. A failure that says only
   `Escalated/Admin/Tags/Listing` is not enough to act on.
2. Diff that against the manifest. JavaScript backends read it out of
   `node_modules/@escalated-dev/escalated/pages.json`, so it cannot go stale;
   everywhere else it is vendored as a fixture and refreshed with the
   dependency.
3. Assert the manifest is actually there and holds more than fifty names. A
   fixture that goes missing would otherwise make the first check pass by
   comparing against nothing.

Write the failure message for whoever hits it. The wording in use:

```
these page names have no component in @escalated-dev/escalated, so they render a blank panel:
  Escalated/Admin/Tags/Listing  (TagController.php)

Either the name is wrong, or the component has not been released yet.
If it has been: refresh tests/Fixtures/escalated-pages.json from the package.
```

### When a name cannot simply be renamed

Sometimes a backend's screen is a different shape from the component's -- it
passes `{ data, filters }` where the component takes flat props, or persists
settings under different keys. Renaming the page name then turns the test green
and leaves the screen just as blank, which is worse than leaving it red.

Those go on a `KNOWN_BLANK` list in the guard test, **with the reason written
against each one**, and a third test that fails if an entry on the list has
since been fixed. The list may shrink. It must never grow.

### Adding a screen

Add the component to the frontend first and release it, then render its name
from the backend. The reverse order ships a blank screen and a green build.

### The name is only half of it

A name that resolves is not a screen that works. Inertia passes props **by
name**: a name the component does not declare is not passed at all -- it lands
on the root element as an attribute -- and the component renders its defaults
instead. The chrome appears and the content does not, on a 200.

That failure hides better than a blank screen does. An empty ticket queue reads
as a quiet day; a report of zeroes reads as a quiet week. Nobody files a bug
about a quiet week.

`pages.json` therefore publishes the props each page reads, alongside the names,
and which of them the component declares required:

```json
"props": {
    "Escalated/Admin/Reports/AgentRanking": { "props": ["agents", "period_days"], "required": [] }
}
```

**Each backend checks its own render payloads against that**, the same way it
checks its names. The check runs in both directions, because both are wrong:

- a **declared prop that is not sent** renders as its default;
- a **sent prop that is not declared** goes nowhere at all.

Where the backend has a request to inspect, assert on the Inertia response.
Where the suite mocks its repository layer and there is no request, read the
literal prop keys at each render site out of the source -- that still catches a
controller sending names nothing declares, which is the whole of the fault that
has actually occurred.

Two things are worth asserting alongside it, because both halves of the
comparison can quietly become empty: that the manifest still describes props at
all, and that the render sites are still being found. A pattern that stops
matching reports a clean controller for the same reason a missing fixture does.

### What this has actually caught

Not hypotheticals -- all of these were live:

- **Twenty-seven report screens across four backends** rendering zeroes, laravel
  included, where the page names had been correct for weeks. `SlaTrends` was
  sent `trends`/`by_department`/`risk_forecast` against `breach_trend`,
  `breach_by_department`, `at_risk_tickets` and four counts nothing produced;
  `AgentRanking` was sent three lists where it reads one called `agents`;
  `Comparison` was sent a metric-keyed object where it reads two periods.
- **Six django screens rendering as permanently empty lists**, the admin, agent
  and customer ticket queues among them, because a bare array plus a sibling
  `pagination` object was handed to components that read `records.data` and page
  through `records.links`.
- **A rails SSO settings form saving keys the SSO implementation never reads**,
  while hiding every key it does.
- **A prop declared in camelCase** (`triggerEvents`) that never matched the
  `trigger_events` every backend sends, because Vue folds kebab-case into
  camelCase and nothing else.

### When the screen is a feature away, not a rename away

Some backends have no equivalent of a screen at all. Those stay on `KNOWN_BLANK`
with the real reason written against them, and the reason matters: "a different
set of fields" reads as a mapping job, and can be wrong by two orders of
magnitude.

Be specific and be numerate. escalated-phoenix's entry says the shared Settings
screen submits 52 fields and the package has about seven of the concepts.
escalated-rails' CSAT entry says the settings that screen would save are read
nowhere, because nothing in the package ever sends a survey.

A blank screen is obviously broken. A settings form that accepts an SMTP
password and forgets it is not. That is the whole reason the exception list
exists.

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
