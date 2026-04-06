# Testing

Testing strategy, tools, and patterns across the Escalated platform.

## Test Pyramid

```
        ┌─────────┐
        │   E2E   │  Few: critical user journeys only
        │Playwright│
        ├─────────┤
        │ Feature │  Many: full HTTP request cycle
        │  Tests  │
        ├─────────┤
        │  Integ  │  Service + driver + DB together
        │  Tests  │
        ├─────────┤
        │  Unit   │  Most: services, helpers, pure logic
        │  Tests  │
        └─────────┘
```

### Unit Tests

Test individual functions and service methods in isolation. Dependencies are mocked or stubbed.

**What to unit test:**
- Service methods (TicketService, SlaService, AssignmentService, etc.)
- Business rules (SLA breach calculation, escalation rule matching, priority mapping)
- Data transformations (filters, serializers, formatters)
- Utility functions (business hours calculator, reference generation)

**What NOT to unit test:**
- Framework boilerplate (model accessors, simple getters/setters)
- Config loading
- Third-party library internals

### Integration Tests

Test multiple components working together, typically with a real database.

**What to integration test:**
- Driver implementations (LocalDriver, SyncedDriver, CloudDriver)
- Plugin hook dispatch chain (Bridge -> Runtime -> Plugin -> ctx.* proxy)
- Email parsing and ingestion
- Webhook dispatch and signature verification
- Import services with sample data

### Feature Tests

Test full HTTP request/response cycles. The test makes an HTTP request and asserts on the response status, headers, and body.

**What to feature test:**
- Every API endpoint (CRUD operations, error cases, authorization)
- Every Inertia page route (correct component rendered, correct props)
- Guest ticket flows (creation, access via token)
- File upload and download
- Inbound email webhook endpoints

### E2E Tests

Playwright tests for critical user journeys. Run in CI against a real browser.

**What to E2E test:**
- Agent: login, view dashboard, open ticket, reply, assign, resolve
- Customer: create ticket, view ticket, reply
- Admin: create department, configure SLA, create escalation rule
- Guest: submit ticket, view via token link

## Framework-Specific Test Tools

### PHP (Laravel) -- Pest

```bash
cd escalated-laravel && vendor/bin/pest
```

- **Runner**: Pest (built on PHPUnit)
- **Config**: `phpunit.xml`
- **Database**: SQLite in-memory for speed
- **HTTP testing**: Laravel's built-in `$this->get()`, `$this->post()`, etc.
- **Factories**: Eloquent model factories for test data
- **Assertions**: Pest expectations + Laravel assertions (`assertInertia`, `assertDatabaseHas`)

```php
it('creates a ticket', function () {
    $user = User::factory()->create();
    $department = Department::factory()->create();

    $this->actingAs($user)
        ->post('/support/tickets', [
            'subject' => 'Test ticket',
            'body' => 'Test body',
            'department_id' => $department->id,
        ])
        ->assertRedirect();

    expect(Ticket::count())->toBe(1);
    expect(Ticket::first()->subject)->toBe('Test ticket');
});
```

### PHP (Filament) -- Pest + Livewire Testing

```bash
cd escalated-filament && vendor/bin/pest
```

Uses Filament's Livewire testing utilities alongside standard Laravel testing.

### PHP (Symfony) -- PHPUnit

```bash
cd escalated-symfony && vendor/bin/phpunit
```

- **Runner**: PHPUnit
- **Config**: `phpunit.xml`
- **Database**: SQLite or PostgreSQL test database
- **HTTP testing**: Symfony's WebTestCase

### PHP (WordPress) -- PHPUnit

```bash
cd escalated-wordpress && vendor/bin/phpunit
```

- **Runner**: PHPUnit with WP_UnitTestCase
- **Config**: `phpunit.xml.dist`
- **Database**: MySQL test database (WordPress core requirement)
- **WordPress test lib**: `wp-tests-lib` scaffolding

### Python (Django) -- pytest

```bash
cd escalated-django && pytest
```

- **Runner**: pytest with pytest-django
- **Config**: `pyproject.toml`
- **Database**: SQLite in-memory
- **Fixtures**: pytest fixtures + Django's `TestCase.setUp`
- **Assertions**: pytest assertions + Django's `assertContains`, `assertRedirects`

```python
def test_create_ticket(client, user, department):
    client.force_login(user)
    response = client.post('/support/tickets/create/', {
        'subject': 'Test ticket',
        'body': 'Test body',
        'department': department.id,
    })
    assert response.status_code == 302
    assert Ticket.objects.count() == 1
```

### Ruby (Rails) -- RSpec

```bash
cd escalated-rails && bundle exec rspec
```

- **Runner**: RSpec
- **Config**: `spec/spec_helper.rb`
- **Database**: SQLite in-memory
- **Factories**: FactoryBot
- **Assertions**: RSpec expectations + Rails matchers

```ruby
RSpec.describe Escalated::TicketService do
  it 'creates a ticket' do
    user = create(:user)
    department = create(:escalated_department)

    ticket = described_class.create(
      requester: user,
      subject: 'Test ticket',
      body: 'Test body',
      department_id: department.id
    )

    expect(ticket).to be_persisted
    expect(ticket.subject).to eq('Test ticket')
  end
end
```

### TypeScript (AdonisJS) -- Japa

```bash
cd escalated-adonis && node ace test
```

- **Runner**: Japa (AdonisJS test runner)
- **Config**: `tests/bootstrap.ts`
- **Database**: SQLite in-memory
- **HTTP testing**: AdonisJS API client

### TypeScript (Plugin SDK + Runtime) -- Vitest

```bash
cd escalated-plugin-sdk && npm test
cd escalated-plugin-runtime && npm test
```

- **Runner**: Vitest
- **Config**: `vitest.config.ts` or inline in `package.json`
- **Mocking**: Vitest's built-in `vi.mock()`, `vi.fn()`

```typescript
import { describe, it, expect } from 'vitest'
import { definePlugin } from '../src/define-plugin'

describe('definePlugin', () => {
  it('normalizes filter handlers', () => {
    const plugin = definePlugin({
      name: 'test',
      version: '1.0.0',
      filters: {
        'ticket.statuses': async (statuses) => [...statuses, { key: 'custom' }],
      },
    })

    expect(plugin.filters).toHaveLength(1)
    expect(plugin.filters[0].hook).toBe('ticket.statuses')
  })
})
```

### Elixir (Phoenix) -- ExUnit

```bash
cd escalated-phoenix && mix test
```

- **Runner**: ExUnit
- **Config**: `test/test_helper.exs`
- **Database**: Ecto sandbox (PostgreSQL)
- **Factories**: ExMachina

### Go -- testing + testify

```bash
cd escalated-go && go test ./...
```

- **Runner**: Go's built-in `testing` package
- **Assertions**: testify
- **Database**: SQLite in-memory for unit tests, PostgreSQL for integration
- **HTTP testing**: `httptest.NewRecorder()`

### Rust (Desktop) -- cargo test

```bash
cd escalated-desktop && cargo test
```

### Dart (Flutter) -- flutter test

```bash
cd escalated-flutter && flutter test
```

- **Runner**: Flutter's built-in test framework
- **Mocking**: Mocktail
- **Widget testing**: `WidgetTester`

## CI Pipeline Patterns

Every repo uses GitHub Actions with a standard pipeline:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - # Language-specific setup
      - # Install dependencies
      - # Run linter/formatter check
      - # Run tests
      - # Upload coverage (optional)
```

### Matrix Testing

Backend packages test across multiple versions:

| Repo | Matrix |
|------|--------|
| escalated-laravel | PHP 8.2/8.3/8.4 x Laravel 11/12/13 |
| escalated-django | Python 3.10/3.11/3.12/3.13 x Django 4.2/5.0/5.1 |
| escalated-rails | Ruby 3.1/3.2/3.3 x Rails 7.0/7.1/7.2/8.0 |
| escalated-symfony | PHP 8.2/8.3/8.4 x Symfony 6.4/7.x |
| escalated-adonis | Node.js 20/22 |

### Screenshot Testing

`escalated-wordpress` has a Playwright-based screenshot pipeline that generates screenshots on every release and commits them to the repo. See `.github/workflows/screenshots.yml`.

## Mocking Patterns

### Mock the Driver, Not the Database

When testing services, mock the `TicketDriver` interface rather than the database:

```php
// Good: mock the driver
$driver = Mockery::mock(TicketDriver::class);
$driver->shouldReceive('createTicket')->once()->andReturn($ticket);
$service = new TicketService($driver);

// Bad: test against real DB in a unit test
$ticket = Ticket::create([...]);  // This is an integration test
```

### Mock External Services

Plugin HTTP calls, cloud API calls, and email sends should always be mocked in tests:

```php
Http::fake([
    'cloud.escalated.dev/*' => Http::response(['id' => 1], 200),
]);
```

### Test Doubles for Plugin Runtime

The plugin bridge provides a test mode where hooks are dispatched synchronously without spawning a Node.js process. Use this in framework tests to verify hook dispatch without the full runtime.

## What to Test vs. What Not to Test

### Always Test

- Service methods with business logic
- Authorization checks (can agent X access ticket Y?)
- SLA breach calculations
- Escalation rule matching
- API endpoint responses (status codes, payloads, error formats)
- Input validation (reject bad input, accept good input)
- Driver implementations (all three modes)
- Plugin hook dispatch and response handling
- Webhook signature verification
- File upload validation

### Do Not Test

- Framework internals (Eloquent relations work, Django ORM works, etc.)
- Simple CRUD with no business logic
- CSS / visual appearance (use screenshot tests for WordPress)
- Third-party package behavior
- Getter/setter methods with no logic
- Config file loading
