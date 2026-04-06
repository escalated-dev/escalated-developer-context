# Testing Strategy

Practical guidance on what to test, how to test it, and patterns for effective tests across the Escalated platform.

## Principles

1. **Test behavior, not implementation** -- Assert on outcomes (ticket was created, SLA breached, email sent) not on how the code is structured internally.
2. **Test at the right level** -- Use the lowest-cost test that covers the behavior. Unit tests for logic, integration tests for DB interactions, feature tests for HTTP flows.
3. **Mock at boundaries** -- Mock external services (HTTP calls, email, cloud API), not your own code.
4. **Fast by default** -- Use in-memory SQLite where possible. Avoid unnecessary setup.
5. **One assertion per concept** -- A test can have multiple assertions if they all verify the same concept.

## What Each Layer Tests

### Unit Tests (Services)

Test service methods with mocked dependencies:

```php
// Laravel (Pest)
it('assigns ticket via round-robin', function () {
    $driver = Mockery::mock(TicketDriver::class);
    $driver->shouldReceive('assignTicket')->once()->with($ticket, 2, null)->andReturn($ticket);

    $service = new AssignmentService($driver);
    $result = $service->assignRoundRobin($ticket, $department);

    expect($result->assigned_agent_id)->toBe(2);
});
```

```python
# Django (pytest)
def test_sla_breach_detection(mock_driver, ticket):
    service = SlaService(mock_driver)
    ticket.sla_response_due = timezone.now() - timedelta(hours=1)

    assert service.is_breached(ticket) is True
```

```ruby
# Rails (RSpec)
it 'escalates when conditions match' do
  driver = double(TicketDriver)
  service = Escalated::EscalationService.new(driver)

  rule = create(:escalation_rule, condition: 'priority_urgent')
  ticket = create(:ticket, priority: :urgent)

  expect(service.evaluate(ticket, [rule])).to include(rule)
end
```

### Integration Tests (Drivers)

Test drivers against a real database:

```php
it('creates a ticket in the local database', function () {
    $driver = new LocalDriver();
    $user = User::factory()->create();

    $ticket = $driver->createTicket($user, [
        'subject' => 'Test',
        'body' => 'Test body',
    ]);

    expect($ticket)->toBeInstanceOf(Ticket::class);
    expect($ticket->exists)->toBeTrue();
    $this->assertDatabaseHas('escalated_tickets', ['id' => $ticket->id]);
});
```

### Feature Tests (Controllers + API)

Test the full HTTP cycle:

```php
it('creates a ticket via API', function () {
    $token = ApiToken::factory()->create(['abilities' => ['tickets:write']]);

    $this->withToken($token->plain_text)
        ->postJson('/support/api/v1/tickets', [
            'subject' => 'API ticket',
            'body' => 'Created via API',
        ])
        ->assertCreated()
        ->assertJsonPath('data.subject', 'API ticket');
});

it('rejects unauthorized agent access', function () {
    $customer = User::factory()->create();

    $this->actingAs($customer)
        ->get('/support/agent/dashboard')
        ->assertForbidden();
});
```

### Plugin Tests

Test plugin handlers with a mock context:

```typescript
describe('slack-plugin', () => {
  it('sends notification on ticket.created', async () => {
    const ctx = createMockContext({
      config: { webhook_url: 'https://hooks.slack.com/...' },
    })

    await plugin.handleAction('ticket.created', {
      id: 1,
      subject: 'Help',
      priority: 'high',
    }, ctx)

    expect(ctx.http.post).toHaveBeenCalledWith(
      'https://hooks.slack.com/...',
      expect.objectContaining({
        text: expect.stringContaining('Help'),
      })
    )
  })
})
```

## Common Test Patterns

### Factory Pattern

All frameworks use factories/fixtures to create test data:

```php
// Laravel: Model factories
$ticket = Ticket::factory()
    ->for(Department::factory(), 'department')
    ->has(Reply::factory()->count(3))
    ->create(['priority' => 'urgent']);
```

```python
# Django: pytest fixtures
@pytest.fixture
def ticket(department, user):
    return Ticket.objects.create(
        subject='Test', body='Body',
        department=department, requester=user
    )
```

```ruby
# Rails: FactoryBot
let(:ticket) { create(:escalated_ticket, :urgent, department: department) }
```

### Time Travel

SLA and escalation tests require time manipulation:

```php
// Laravel
$this->travel(2)->hours();
expect($slaService->isBreached($ticket))->toBeTrue();
```

```python
# Django (freezegun)
@freeze_time("2026-04-05 12:00:00")
def test_sla_breach():
    ...
```

```ruby
# Rails (Timecop)
Timecop.travel(2.hours.from_now) do
  expect(service.breached?(ticket)).to be true
end
```

### HTTP Mocking

Mock external HTTP calls (cloud API, webhooks, plugin HTTP):

```php
// Laravel
Http::fake([
    'cloud.escalated.dev/*' => Http::response(['id' => 1], 200),
    'hooks.slack.com/*' => Http::response('ok', 200),
]);
```

```python
# Django (responses library)
@responses.activate
def test_cloud_sync():
    responses.add(responses.POST, 'https://cloud.escalated.dev/api/v1/sync', json={'ok': True})
    ...
```

### Database Assertions

```php
// Laravel
$this->assertDatabaseHas('escalated_tickets', [
    'subject' => 'Test',
    'status' => 'open',
]);
$this->assertDatabaseCount('escalated_replies', 3);
$this->assertSoftDeleted('escalated_tickets', ['id' => $ticket->id]);
```

## CI Pipeline Structure

Every repo's CI pipeline follows this pattern:

```yaml
name: Tests
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - # Run formatter/linter check

  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        # Framework-specific version matrix
    steps:
      - uses: actions/checkout@v4
      - # Install dependencies
      - # Run test suite
      - # Upload coverage (optional)
```

### Version Matrices

Test across supported framework and language versions to catch compatibility issues early:

- **PHP repos**: PHP 8.2/8.3/8.4 x Framework versions
- **Python repos**: Python 3.10/3.11/3.12/3.13 x Django versions
- **Ruby repos**: Ruby 3.1/3.2/3.3 x Rails versions
- **Node repos**: Node 20/22
- **Go repos**: Go 1.21/1.22/1.23
- **Elixir repos**: Elixir 1.15/1.16/1.17

## Anti-Patterns to Avoid

1. **Testing the ORM** -- Don't test that `Ticket::create()` persists to the database. The ORM works. Test your business logic around it.

2. **Brittle UI tests** -- Don't write E2E tests for every page. Use feature tests for route responses and limit E2E to critical user journeys.

3. **Mocking everything** -- If you mock every dependency, you're testing mock behavior, not real behavior. Integration tests with a real DB are more valuable than fully-mocked unit tests for data-heavy operations.

4. **Testing private methods** -- Test through the public API. If a private method needs its own tests, it should probably be extracted into its own class.

5. **Slow test suites** -- Keep the full suite under 60 seconds. Use in-memory SQLite, avoid unnecessary HTTP calls, and parallelize where possible.
