# Cloud Driver Pattern

How the three hosting modes work and how to implement drivers.

## Overview

Escalated supports three hosting modes, each implemented as a driver. The active driver is resolved from config at boot time. All services and controllers depend on the driver interface, never a concrete implementation.

## Mode Comparison

| | Self-Hosted | Synced | Cloud |
|---|---|---|---|
| **Data location** | Local DB only | Local DB + cloud replica | Cloud only |
| **Latency** | Lowest (local queries) | Low (local reads, async sync) | Higher (HTTP calls) |
| **Data sovereignty** | Full control | Partial (cloud has copy) | Cloud-managed |
| **Offline capable** | Yes | Yes (degrades to local) | No |
| **Cross-app visibility** | No | Yes (via cloud dashboard) | Yes |
| **Infrastructure** | You manage | You manage + cloud | Cloud manages |
| **Config value** | `self-hosted` | `synced` | `cloud` |

## LocalDriver

The simplest driver. All operations go directly to the local database via the framework's ORM.

```
Request -> Controller -> Service -> LocalDriver -> ORM -> Local DB
```

### Implementation Pattern

```php
class LocalDriver implements TicketDriver
{
    public function createTicket(Ticketable $requester, array $data): Ticket
    {
        $ticket = Ticket::create([
            'subject' => $data['subject'],
            'body' => $data['body'],
            'requester_id' => $requester->getKey(),
            'status' => TicketStatus::Open,
            'priority' => $data['priority'] ?? TicketPriority::Medium,
            'department_id' => $data['department_id'] ?? null,
            'reference' => $this->generateReference(),
        ]);

        event(new TicketCreated($ticket));

        return $ticket;
    }

    public function listTickets(array $filters = [], ?Ticketable $for = null): LengthAwarePaginator
    {
        $query = Ticket::query();

        if ($for) {
            $query->where('requester_id', $for->getKey());
        }

        // Apply filters (status, priority, department, agent, tags, search, date range)
        foreach ($filters as $key => $value) {
            match ($key) {
                'status' => $query->where('status', $value),
                'priority' => $query->where('priority', $value),
                'department_id' => $query->where('department_id', $value),
                'assigned_agent_id' => $query->where('assigned_agent_id', $value),
                'search' => $query->where(fn ($q) => $q->where('subject', 'like', "%{$value}%")->orWhere('reference', $value)),
                default => null,
            };
        }

        return $query->latest()->paginate($filters['per_page'] ?? 25);
    }

    // ... other methods follow the same pattern
}
```

## SyncedDriver

Writes locally first, then asynchronously replicates to the cloud. This provides the best of both worlds: fast local operations with cross-app cloud visibility.

```
Request -> Controller -> Service -> SyncedDriver -> ORM -> Local DB
                                         |
                                         +-> Async Job -> Cloud API
```

### Implementation Pattern

```php
class SyncedDriver implements TicketDriver
{
    public function __construct(
        private LocalDriver $localDriver,
        private string $apiUrl,
        private string $apiKey,
    ) {}

    public function createTicket(Ticketable $requester, array $data): Ticket
    {
        // Step 1: Write locally (delegates to LocalDriver)
        $ticket = $this->localDriver->createTicket($requester, $data);

        // Step 2: Queue async sync to cloud
        dispatch(new SyncTicketToCloud($ticket, 'created'));

        return $ticket;
    }

    // All read operations delegate to LocalDriver (fast local queries)
    public function getTicket(int|string $id): Ticket
    {
        return $this->localDriver->getTicket($id);
    }

    public function listTickets(array $filters = [], ?Ticketable $for = null): LengthAwarePaginator
    {
        return $this->localDriver->listTickets($filters, $for);
    }
}
```

### Sync Job

```php
class SyncTicketToCloud implements ShouldQueue
{
    use Queueable;

    public int $tries = 5;
    public array $backoff = [1, 5, 30, 120, 600];

    public function handle(): void
    {
        Http::withToken($this->apiKey)
            ->post("{$this->apiUrl}/sync", [
                'type' => $this->eventType,
                'data' => $this->ticket->toArray(),
            ]);
    }
}
```

### Offline Resilience

When the cloud is unreachable:
- Local operations succeed normally
- Sync jobs are queued and retried with exponential backoff
- Failed jobs are stored in the framework's failed job table
- When connectivity is restored, queued syncs are processed

## CloudDriver

All operations are proxied to the Escalated Cloud API. No local database is used for ticket data.

```
Request -> Controller -> Service -> CloudDriver -> HTTP -> cloud.escalated.dev/api/v1
```

### Implementation Pattern

```php
class CloudDriver implements TicketDriver
{
    public function __construct(
        private string $apiUrl,
        private string $apiKey,
    ) {}

    public function createTicket(Ticketable $requester, array $data): Ticket
    {
        $response = Http::withToken($this->apiKey)
            ->post("{$this->apiUrl}/tickets", [
                'subject' => $data['subject'],
                'body' => $data['body'],
                'requester_email' => $requester->email,
                'priority' => $data['priority'] ?? 'medium',
                'department_id' => $data['department_id'] ?? null,
            ]);

        return Ticket::fromApiResponse($response->json());
    }

    public function listTickets(array $filters = [], ?Ticketable $for = null): LengthAwarePaginator
    {
        $params = $filters;
        if ($for) {
            $params['requester_email'] = $for->email;
        }

        $response = Http::withToken($this->apiKey)
            ->get("{$this->apiUrl}/tickets", $params);

        return Ticket::paginateFromApiResponse($response->json());
    }
}
```

### Considerations

- **Latency**: Every operation is an HTTP call. Use caching where appropriate.
- **Error handling**: Network failures must be handled gracefully.
- **Authentication**: The host app still handles user authentication. The CloudDriver maps local users to cloud contacts by email.
- **Offline**: Not available. If the cloud API is down, ticket operations fail.

## Driver Resolution

The manager resolves the active driver from config at boot:

```php
class EscalatedManager
{
    public function driver(): TicketDriver
    {
        return match (config('escalated.mode')) {
            'self-hosted' => new LocalDriver(),
            'synced' => new SyncedDriver(
                new LocalDriver(),
                config('escalated.hosted.api_url'),
                config('escalated.hosted.api_key'),
            ),
            'cloud' => new CloudDriver(
                config('escalated.hosted.api_url'),
                config('escalated.hosted.api_key'),
            ),
        };
    }
}
```

## Implementing a New Driver

If you need a custom hosting mode (e.g., multi-region, custom backend):

1. Implement the `TicketDriver` interface with all required methods
2. Register your driver in the manager
3. Add a config option to select it
4. Write integration tests for every method

Every method must:
- Accept the same parameters as the interface defines
- Return the same types
- Dispatch the same events (so listeners, plugins, and webhooks still fire)
