# Plugin Development Guide

How to build an Escalated plugin using the Plugin SDK.

## Overview

Plugins extend Escalated with custom behavior. A plugin is a TypeScript package that uses `definePlugin()` from the SDK. Once published to npm, it can be installed in any Escalated instance and activated via the admin panel.

## Prerequisites

- Node.js 18+
- TypeScript 5.4+
- npm account (for publishing)

## Quick Start

### 1. Create the Project

```bash
mkdir escalated-plugin-my-feature
cd escalated-plugin-my-feature
npm init -y
npm install @escalated-dev/plugin-sdk
npm install -D typescript
npx tsc --init
```

### 2. Define the Plugin

```typescript
// src/index.ts
import { definePlugin } from '@escalated-dev/plugin-sdk'

export default definePlugin({
  name: 'my-feature',
  version: '1.0.0',
  description: 'Adds my custom feature to Escalated',

  actions: {
    'ticket.created': async (event, ctx) => {
      ctx.log.info('New ticket created', { ticketId: event.id })
    },
  },
})
```

### 3. Build and Test

```bash
npx tsc
npm test
```

### 4. Publish

```bash
npm publish --access public
```

## Plugin Definition API

### Name and Version

```typescript
definePlugin({
  name: 'my-plugin',           // Unique identifier (kebab-case)
  version: '1.0.0',            // Semver
  description: 'What it does', // Shown in marketplace/admin
})
```

### Config Fields

Define admin-configurable settings:

```typescript
config: [
  { name: 'api_key', label: 'API Key', type: 'password', required: true },
  { name: 'channel', label: 'Notification Channel', type: 'text', default: '#support' },
  { name: 'notify_on', label: 'Notify On', type: 'select', options: [
    { label: 'All tickets', value: 'all' },
    { label: 'High priority only', value: 'high' },
  ]},
  { name: 'enabled', label: 'Enabled', type: 'boolean', default: true },
],
```

Config values are readable in handlers via `ctx.config.get('api_key')`.

### Actions (Fire-and-Forget)

React to events without modifying them:

```typescript
actions: {
  'ticket.created': async (event, ctx) => {
    const config = await ctx.config.get('webhook_url')
    await ctx.http.post(config, { text: `New ticket: ${event.subject}` })
  },
  'ticket.resolved': async (event, ctx) => {
    ctx.log.info('Ticket resolved', event)
  },
},
```

Available hooks: `ticket.created`, `ticket.updated`, `ticket.status_changed`, `ticket.assigned`, `ticket.unassigned`, `ticket.escalated`, `ticket.priority_changed`, `ticket.department_changed`, `ticket.tagged`, `ticket.untagged`, `ticket.merged`, `reply.created`, `reply.updated`, `sla.breached`, `sla.warning`, `agent.online`, `agent.offline`, `rating.submitted`.

### Filters (Transform Data)

Modify data as it passes through the system. Must return the (possibly modified) value:

```typescript
filters: {
  'ticket.statuses': async (statuses, ctx) => {
    return [...statuses, { key: 'waiting_approval', name: 'Waiting for Approval' }]
  },
  'ticket.reply.compose': {
    priority: 5,  // Lower runs first (default: 10)
    handler: async (data, ctx) => {
      return { ...data, signature: 'Sent via My Plugin' }
    },
  },
},
```

### Endpoints (Custom REST Routes)

Expose plugin-specific API routes:

```typescript
endpoints: {
  'GET /my-plugin/status': async (ctx, req) => {
    return { ok: true, version: '1.0.0' }
  },
  'POST /my-plugin/configure': {
    capability: 'manage_settings',  // Requires admin
    handler: async (ctx, req) => {
      await ctx.config.set('setting', req.body.value)
      return { saved: true }
    },
  },
},
```

Endpoints are mounted under the Escalated route prefix (e.g., `/support/plugins/my-plugin/status`).

### Webhooks (Incoming)

Handle incoming webhooks from external services:

```typescript
webhooks: {
  'POST /webhooks/my-service': async (ctx, req) => {
    const event = req.body
    if (event.type === 'message') {
      await ctx.tickets.create({
        subject: event.subject,
        body: event.text,
        requesterEmail: event.from,
      })
    }
    return { received: true }
  },
},
```

### Cron (Scheduled Tasks)

Run tasks on a schedule:

```typescript
cron: {
  '0 9 * * 1': async (ctx) => {
    ctx.log.info('Running weekly report')
    const tickets = await ctx.tickets.query({ status: 'open' })
    // Generate and send report...
  },
  '*/5 * * * *': async (ctx) => {
    // Every 5 minutes
  },
},
```

### UI Extensions

#### Pages (Full Routes)

```typescript
pages: [
  {
    route: '/admin/my-plugin',
    component: 'MySettingsPage',   // Vue component name
    layout: 'admin',               // admin, agent, or customer
    capability: 'manage_settings', // Required capability
    menu: {
      label: 'My Plugin',
      section: 'admin',           // Menu section
      position: 50,               // Sort order
    },
  },
],
```

#### Components (Injected into Existing Pages)

```typescript
components: [
  {
    page: 'ticket.show',     // Target page
    slot: 'sidebar',          // Injection slot
    component: 'MyPanel',     // Vue component name
    order: 20,                // Sort order within slot
  },
],
```

#### Widgets (Dashboard)

```typescript
widgets: [
  {
    component: 'MyWidget',
    label: 'My Stats',
    size: 'half',              // 'full', 'half', 'third'
    badge: async (ctx) => {
      const count = await ctx.store.query('alerts', { unread: true })
      return count.length || null
    },
  },
],
```

### Lifecycle Hooks

```typescript
onActivate: async (ctx) => {
  // Called when plugin is activated in admin panel
  await ctx.store.set('data', 'initialized', { at: new Date() })
},

onDeactivate: async (ctx) => {
  // Called when plugin is deactivated
  // Cleanup external resources
},
```

## Plugin Context (`ctx`)

The context object provides all services a plugin needs:

### Data Operations

```typescript
// Tickets
const ticket = await ctx.tickets.find(42)
const tickets = await ctx.tickets.query({ status: 'open', priority: 'high' })
const newTicket = await ctx.tickets.create({ subject: 'From plugin', body: '...', requesterEmail: 'user@example.com' })
await ctx.tickets.update(42, { priority: 'urgent' })

// Replies
const reply = await ctx.replies.create(ticketId, { body: 'Auto-reply from plugin' })

// Contacts
const contact = await ctx.contacts.findByEmail('user@example.com')

// Tags, Departments, Agents
const tags = await ctx.tags.list()
const dept = await ctx.departments.find(1)
const agents = await ctx.agents.list()
```

### Plugin Storage

```typescript
// Key-value store (scoped to your plugin)
await ctx.store.set('cache', 'last-sync', { timestamp: Date.now() })
const data = await ctx.store.get('cache', 'last-sync')

// Query stored records
const records = await ctx.store.query('alerts', { unread: true })
```

### HTTP Client

```typescript
const response = await ctx.http.get('https://api.example.com/data')
const result = await ctx.http.post('https://api.example.com/action', {
  headers: { 'Authorization': 'Bearer token' },
  body: { key: 'value' },
})
```

### Broadcasting

```typescript
await ctx.broadcast.toChannel('agents', { type: 'notification', message: 'Alert!' })
await ctx.broadcast.toUser(userId, { type: 'update', data: {...} })
await ctx.broadcast.toTicket(ticketId, { type: 'new-reply' })
```

### Logging

```typescript
ctx.log.info('Operation completed', { ticketId: 42 })
ctx.log.warn('Rate limit approaching', { remaining: 5 })
ctx.log.error('External API failed', { status: 500, url: '...' })
ctx.log.debug('Processing event', event)
```

## Testing Plugins

Use Vitest:

```typescript
import { describe, it, expect, vi } from 'vitest'
import plugin from '../src/index'

describe('my-plugin', () => {
  it('handles ticket.created', async () => {
    const ctx = {
      config: { get: vi.fn().mockResolvedValue('https://webhook.example.com') },
      http: { post: vi.fn().mockResolvedValue({ ok: true }) },
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }

    const handler = plugin.actions.find(a => a.hook === 'ticket.created')
    await handler.handler({ id: 1, subject: 'Test' }, ctx)

    expect(ctx.http.post).toHaveBeenCalledWith(
      'https://webhook.example.com',
      expect.objectContaining({ text: expect.stringContaining('Test') })
    )
  })
})
```

## Publishing

1. Set the package name to `@escalated-dev/plugin-{name}` (or your own scope for third-party plugins)
2. Set `main` to the compiled output (`dist/index.js`)
3. Build: `npx tsc`
4. Publish: `npm publish --access public`

The plugin runtime discovers plugins by scanning `node_modules/@escalated-dev/plugin-*`. Third-party plugins can use any npm scope but must be configured explicitly.
