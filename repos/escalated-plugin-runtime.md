# escalated-plugin-runtime

[![Tests](https://github.com/escalated-dev/escalated-plugin-runtime/actions/workflows/run-tests.yml/badge.svg)](https://github.com/escalated-dev/escalated-plugin-runtime/actions/workflows/run-tests.yml)

**Language**: TypeScript | **Package**: npm (`@escalated-dev/plugin-runtime`)

The runtime host that loads and executes plugins built with the Plugin SDK. Communicates with the host framework via JSON-RPC 2.0 over stdio.

## How It Works

The runtime is a long-lived Node.js process spawned by the framework bridge:

```bash
node node_modules/@escalated-dev/plugin-runtime/dist/index.js
```

You do not invoke it directly. The bridge spawns it automatically on the first hook dispatch.

## Architecture

```
Host Framework (PHP/Ruby/Python)         Plugin Runtime (Node.js)
┌──────────────────────────┐   stdio    ┌──────────────────────────┐
│  Bridge                  │<---------->│  @escalated-dev/          │
│  - spawns subprocess     │  JSON-     │    plugin-runtime         │
│  - dispatches hooks      │  RPC 2.0  │  ┌────────────────────┐   │
│  - handles ctx.* calls   │           │  │ plugin-slack        │   │
│                          │           │  │ plugin-jira         │   │
│                          │           │  │ your-custom-plugin  │   │
└──────────────────────────┘           │  └────────────────────┘   │
                                       └──────────────────────────┘
```

### Lifecycle

1. **Discovery** -- Scans `node_modules/@escalated-dev/plugin-*` for installed plugins
2. **Loading** -- Imports each plugin's default export (the `definePlugin()` result)
3. **Registration** -- Indexes all action/filter hooks, endpoints, webhooks, cron jobs
4. **Listening** -- Reads JSON-RPC messages from stdin, dispatches to handlers
5. **Proxying** -- When a handler calls `ctx.*`, the runtime sends a JSON-RPC request back to the host framework over stdout

### Resilience

- **Lazy spawn** -- Not started until the first hook is dispatched
- **Auto-restart** -- Exponential backoff on crash (1s, 2s, 4s, 8s, max 30s)
- **Graceful degradation** -- Action hooks are silently skipped when runtime is unavailable
- **Filter passthrough** -- Filter hooks return unmodified values when runtime is down

## Source Files

```
src/
├── index.ts                # Entry point (starts the runtime)
├── runtime.ts              # Main runtime loop (message handling)
├── plugin-loader.ts        # Plugin discovery and loading
├── dispatcher.ts           # Hook dispatch (actions, filters, endpoints)
├── context-proxy.ts        # PluginContext implementation (proxies ctx.* to host)
└── json-rpc.ts             # JSON-RPC 2.0 message encoding/decoding
```

## Protocol

Communication uses JSON-RPC 2.0 over stdin/stdout.

### Hook Dispatch (Host -> Runtime)

```json
{
  "jsonrpc": "2.0",
  "method": "hook.dispatch",
  "params": {
    "type": "action",
    "hook": "ticket.created",
    "payload": { "id": 1, "subject": "Help", "status": "open" }
  },
  "id": 1
}
```

### Context Proxy (Runtime -> Host)

```json
{
  "jsonrpc": "2.0",
  "method": "ctx.tickets.find",
  "params": { "id": 42 },
  "id": 2
}
```

The host framework handles `ctx.*` calls by querying its own database/services and returning the result.

## Running Tests

```bash
npm test
```

Uses Vitest.
