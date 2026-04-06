# escalated-cloud

**Purpose**: Cloud API at `cloud.escalated.dev`

The Escalated Cloud is the hosted backend that powers the `synced` and `cloud` hosting modes. It provides a multi-tenant REST API, cross-app reporting, and centralized configuration.

## What It Does

1. **REST API** (`/api/v1`) -- Full CRUD for tickets, replies, departments, tags, SLA policies, agents, and more
2. **Multi-tenant** -- Each connected app is a tenant with isolated data
3. **Cross-app dashboard** -- Unified view of tickets across all connected instances
4. **Webhook delivery** -- Outbound webhooks for cloud events
5. **SSO** -- Single sign-on across cloud-connected instances
6. **Plugin marketplace** -- Central registry for plugin distribution

## How Backend Packages Connect

### Synced Mode

The `SyncedDriver` in each backend package writes locally first, then asynchronously replicates events to the Cloud API:

```
Local DB write -> Event -> Async job -> POST cloud.escalated.dev/api/v1/sync
```

If the cloud is unreachable, events are queued and retried with exponential backoff.

### Cloud Mode

The `CloudDriver` proxies all CRUD operations directly to the Cloud API:

```
Request -> Controller -> CloudDriver -> GET/POST cloud.escalated.dev/api/v1/tickets
```

No local DB is used for ticket data. The host app only handles authentication and UI rendering.

## Authentication

- **API key**: `ESCALATED_API_KEY` env var, sent as `Authorization: Bearer {key}`
- **Per-key abilities**: Scoped access (read, write, admin)
- **Rate limiting**: Configurable per-tenant

## API Endpoints

The Cloud API mirrors the `TicketDriver` interface:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/tickets` | List tickets |
| POST | `/api/v1/tickets` | Create ticket |
| GET | `/api/v1/tickets/{id}` | Get ticket |
| PATCH | `/api/v1/tickets/{id}` | Update ticket |
| POST | `/api/v1/tickets/{id}/replies` | Add reply |
| POST | `/api/v1/tickets/{id}/assign` | Assign ticket |
| POST | `/api/v1/tickets/{id}/status` | Transition status |
| GET | `/api/v1/departments` | List departments |
| GET | `/api/v1/tags` | List tags |
| GET | `/api/v1/sla-policies` | List SLA policies |
| POST | `/api/v1/sync` | Receive sync events (synced mode) |
