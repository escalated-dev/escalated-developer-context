# escalated-plugin-sdk

[![Tests](https://github.com/escalated-dev/escalated-plugin-sdk/actions/workflows/run-tests.yml/badge.svg)](https://github.com/escalated-dev/escalated-plugin-sdk/actions/workflows/run-tests.yml)

**Language**: TypeScript | **Package**: npm (`@escalated-dev/plugin-sdk`)

The SDK for building Escalated plugins. Provides `definePlugin()` and TypeScript types.

## Installation

```bash
npm install @escalated-dev/plugin-sdk
```

## Requirements

- Node.js 18+
- TypeScript 5.4+

## Core API

### `definePlugin(definition)`

The single entry point for defining a plugin:

```typescript
import { definePlugin } from '@escalated-dev/plugin-sdk'

export default definePlugin({
  name: 'my-plugin',
  version: '1.0.0',
  description: 'Does something useful',

  config: [
    { name: 'api_key', label: 'API Key', type: 'password', required: true },
  ],

  actions: {
    'ticket.created': async (event, ctx) => { /* ... */ },
  },

  filters: {
    'ticket.statuses': async (statuses, ctx) => [...statuses, { key: 'custom', name: 'Custom' }],
  },

  endpoints: {
    'GET /my-plugin/status': async (ctx, req) => ({ ok: true }),
  },

  webhooks: {
    'POST /webhooks/my-service': async (ctx, req) => { /* ... */ },
  },

  cron: {
    '0 9 * * 1': async (ctx) => { /* weekly task */ },
  },

  pages: [
    { route: '/admin/my-plugin', component: 'MySettingsPage', layout: 'admin', capability: 'manage_settings' },
  ],

  components: [
    { page: 'ticket.show', slot: 'sidebar', component: 'MyTicketPanel', order: 20 },
  ],

  widgets: [
    { component: 'MyWidget', label: 'My Stats', size: 'half' },
  ],

  onActivate: async (ctx) => { /* setup */ },
  onDeactivate: async (ctx) => { /* cleanup */ },
})
```

### Plugin Context (`ctx`)

Every handler receives a `PluginContext`:

| Property | Type | Purpose |
|----------|------|---------|
| `ctx.config` | `ConfigStore` | Read/write plugin config |
| `ctx.store` | `DataStore` | Persistent key-value store scoped to plugin |
| `ctx.http` | `HttpClient` | Outbound HTTP requests |
| `ctx.broadcast` | `BroadcastClient` | Real-time event broadcasting |
| `ctx.log` | `Logger` | Structured logging (info, warn, error, debug) |
| `ctx.tickets` | `TicketRepository` | Find, query, create, update tickets |
| `ctx.replies` | `ReplyRepository` | Find, query, create replies |
| `ctx.contacts` | `ContactRepository` | Find/create contacts |
| `ctx.tags` | `TagRepository` | List/create tags |
| `ctx.departments` | `DepartmentRepository` | List/find departments |
| `ctx.agents` | `AgentRepository` | List/find agents |
| `ctx.emit` | `function` | Emit custom hooks for other plugins |
| `ctx.currentUser` | `function` | Currently authenticated user |

## Source Files

```
src/
├── index.ts                # Public exports
├── define-plugin.ts        # definePlugin() implementation and normalization
└── types.ts                # TypeScript type definitions
```

## Hook Types

### Actions (fire-and-forget)

```typescript
actions: {
  'ticket.created': async (event, ctx) => {
    // event contains the ticket data
    // Return value is ignored
  },
}
```

### Filters (transform and return)

```typescript
filters: {
  'ticket.statuses': async (statuses, ctx) => {
    // Must return the (possibly modified) value
    return [...statuses, { key: 'custom', name: 'Custom' }]
  },
  // With explicit priority
  'ticket.reply.compose': {
    priority: 5,
    handler: async (data, ctx) => ({ ...data, extra: true }),
  },
}
```

### Endpoints (REST routes)

```typescript
endpoints: {
  'GET /my-plugin/status': async (ctx, req) => ({ ok: true }),
  'POST /my-plugin/action': {
    capability: 'manage_settings',  // Require admin
    handler: async (ctx, req) => { /* ... */ },
  },
}
```

## Running Tests

```bash
npm test
```

Uses Vitest.
