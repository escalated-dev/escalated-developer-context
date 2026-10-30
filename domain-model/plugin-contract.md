# Plugin contract

What every backend provides so that a plugin, and the shared admin screens for
plugins, work the same on all eleven hosts. The plugin authoring API is
`@escalated-dev/plugin-sdk` (`definePlugin`). The screens are
`Escalated/Admin/Plugins/Index` and `Escalated/Plugin/Page` in
`@escalated-dev/escalated`. This doc says what a host does between the two.

escalated-laravel is the port of record. Where this doc and Laravel differ, the
difference is listed under [Known gaps](#known-gaps) and Laravel is the one to
fix.

## Why this exists

Six backends (Laravel, Rails, Django, Adonis, WordPress, Phoenix) grew a plugin
system one at a time, each from the one before. Five (NestJS, .NET, Spring,
Symfony, Go) had none. Nothing written said which parts were the contract and
which were Laravel's PHP idioms, so the copies drifted: Adonis mounts plugin
endpoints at `/plugins/{name}/api/...` and Laravel at `/api/plugins/{name}/...`;
Laravel shares the plugin menu as `plugin_menu_items` while the frontend reads
`escalated.plugins.menuItems`; nobody delivers domain events to SDK plugins.

---

## Two kinds of plugin

| Kind | Written in | Runs | Who must support it |
|---|---|---|---|
| **SDK plugin** | TypeScript, `definePlugin()` | In the host process (Node hosts) or in the plugin runtime subprocess, over the [bridge](#the-sdk-bridge) | Every host. This is the cross-host plugin: the official plugins (`escalated-plugins`) are SDK plugins. |
| **Native plugin** | The host's own language | In the host process | Optional. Laravel (PHP files and Composer packages), Rails, Django, Adonis and Phoenix have one. |

Both kinds share one registry, one activation table and one admin screen. The
rest of this doc is about SDK plugins unless it says otherwise.

How a host runs SDK plugins:

- **Node hosts (NestJS, Adonis)** may load them in-process: the host imports
  the `definePlugin()` object and calls its handlers with a `ctx` it builds
  itself. No subprocess, and activation gates every call per plugin.
- **Every other host** spawns `@escalated-dev/plugin-runtime` and speaks
  JSON-RPC 2.0 to it over stdio. That is opt-in by config and off when Node is
  not installed; the host must start and serve requests without it.

## Identity

- **`name`** is the SDK manifest `name` (`@escalated-dev/plugin-slack`). The
  store and config are keyed by it, and the runtime addresses plugins by it.
- **`slug`** is what goes in URLs, route names and the `escalated_plugins` row:
  the name with a leading `@` removed, each `/` replaced by `--`, and anything
  else outside `[A-Za-z0-9_-]` replaced by `-`. So
  `@escalated-dev/plugin-slack` is `escalated-dev--plugin-slack`. Native
  plugins use their directory or package slug (Laravel: `acme--billing`).

Two plugins with the same slug is a configuration error. Fail at boot and name
both.

## Storage

Two tables, prefixed like every other table. Migrations must run on every
database the host advertises.

**`escalated_plugins`**: one row per plugin that has ever been activated.

| Column | Type | Notes |
|---|---|---|
| `id` | primary key | |
| `slug` | string(255), unique | |
| `is_active` | boolean, default false | |
| `activated_at` | timestamp, nullable | |
| `deactivated_at` | timestamp, nullable | |
| `created_at`, `updated_at` | timestamps | |

A registered plugin with no row is inactive. Activation never depends on a row
existing first.

**`escalated_plugin_store`**: everything `ctx.store` and `ctx.config` write.

| Column | Type | Notes |
|---|---|---|
| `id` | primary key | Returned to plugins as `_id`. |
| `plugin` | string, at least 191 | The plugin **name**. |
| `collection` | string, at least 100 | |
| `key` | string, at least 191, nullable | |
| `data` | JSON (text where the DB has no JSON type) | |
| `created_at`, `updated_at` | timestamps | |

Index `(plugin, collection, key)`; keep the three lengths small enough for
MySQL's index limit (191 + 100 + 191 characters fits). Config lives in the row with
`collection = '__config__'` and `key = '__config__'`; `ctx.config.set` merges
into it. Uninstalling a plugin keeps its store rows; reinstalling finds them.

---

## Admin screen: `Escalated/Admin/Plugins/Index`

All under `{prefix}/admin/plugins`, behind the host's admin guard. The route
names are part of the contract: the page calls them through `route()`.

| Method | Path | Route name | Does |
|---|---|---|---|
| GET | `/plugins` | `escalated.admin.plugins.index` | Renders the page. |
| POST | `/plugins/upload` | `escalated.admin.plugins.upload` | Upload hosts only. Multipart field `plugin`. |
| POST | `/plugins/{slug}/activate` | `escalated.admin.plugins.activate` | [Activate](#lifecycle). |
| POST | `/plugins/{slug}/deactivate` | `escalated.admin.plugins.deactivate` | [Deactivate](#lifecycle). |
| DELETE | `/plugins/{slug}` | `escalated.admin.plugins.destroy` | [Uninstall](#lifecycle). |

Every POST and DELETE answers with a redirect to the index (303, the Inertia
protocol) and a `success` or `error` flash. An unknown slug is an `error` flash
on Inertia requests and a 404 on JSON ones.

### Props

| Prop | Type | Notes |
|---|---|---|
| `plugins` | array of [plugin objects](#the-plugin-object) | Every registered plugin, active or not. |
| `can_upload` | boolean | `false` when plugins are installed by the deployer (package manager, module config) rather than uploaded. The page then hides upload. A host that sends `false` does not register the upload route. |

### The plugin object

| Key | Type | Notes |
|---|---|---|
| `slug` | string | |
| `name` | string | Display name. |
| `description` | string or null | |
| `version` | string | |
| `author` | string or null | |
| `author_url`, `homepage` | string or null | The page links `homepage`; Laravel sends `author_url`. Send both. |
| `is_active` | boolean | |
| `activated_at` | ISO 8601 or null | |
| `installed_at` | ISO 8601 or null | Optional. |
| `source` | string | `local` (uploaded files), `composer` (managed by a package manager: Composer, npm, NuGet, Maven, Go modules; the name is historical), or `registered` (code-registered in module config). |
| `provides` | object or omitted | `{menu_items, widgets, page_components}` counts from the manifest. |

The page offers Delete for every source except `composer`.

## Lifecycle

Each transition runs in this order. A plugin callback that throws is logged
with the plugin's name and does not undo the transition or fail the request.
Every transition is idempotent: activating an active plugin is a success that
does nothing.

**Activate**: upsert the row with `is_active = true`,
`activated_at = now`, `deactivated_at = null`; then call the plugin's
`onActivate(ctx)` (runtime: the `activate` RPC); then fire the action
`plugin.activated` with `{plugin: name, slug}`.

**Deactivate**: fire `plugin.deactivated` while the plugin is still active,
so it can react; call `onDeactivate(ctx)` (runtime: `deactivate`); then set
`is_active = false`, `deactivated_at = now`.

**Uninstall** (`DELETE`):

- `composer`: refuse with an `error` flash. The package manager removes it.
- Otherwise fire `plugin.uninstalling`, deactivate as above, and delete the
  `escalated_plugins` row. A `local` plugin's files are deleted too. A
  `registered` plugin stays in the list, inactive, because its code is still in
  the build.

Lifecycle actions go to every active plugin, the subject included. Native
plugin systems may also fire their legacy names
(`escalated_plugin_activated_{slug}` and so on); SDK plugins only see the
dotted ones.

### Uploads

Only on hosts that send `can_upload: true`:

- Admin only, and platform admin in tenant mode (where nothing runs anyway).
- ZIP, at most 50 MB, one root folder holding `plugin.json`.
- Reject any entry with `..`, an absolute path or a drive letter before
  extracting (zip slip), and a `main_file` that does the same.
- Never overwrite an installed plugin. Uploading does not activate.

## Pages: `Escalated/Plugin/Page`

Each `pages[]` entry of an **active** plugin's manifest is a route:

```
GET {prefix}/admin/plugins/{slug}/{route}
name: escalated.plugin.{slug}.page.{route, "/" replaced by "--"}
```

Leading slashes on `route` are dropped; an entry with an empty `route` or
`component` is skipped with a warning. The route sits behind the admin guard
and, when the page declares `capability`, behind that too (403 without it).

It renders `Escalated/Plugin/Page` with:

| Prop | Value |
|---|---|
| `plugin` | The plugin name. |
| `component` | The page's `component`. |
| `layout` | The page's `layout`, default `admin`. |
| `props` | The result of the plugin's own `GET /{component}` endpoint, or `{}` when it has none or it throws. |

The page resolves `component` from components the plugin's frontend package
registered with `defineEscalatedPlugin`. An inactive or unknown plugin's page is
a 404.

## Endpoints and webhooks

Transport details (`httpContract: 1`, raw body, stripped headers, the
`httpResponse()` envelope) are in the SDK's `docs/http-contract.md` and
Laravel's `docs/plugin-http-contract.md`. Routing:

| Kind | Route | Guard |
|---|---|---|
| Endpoint | `{METHOD} {prefix}/api/plugins/{slug}{path}` | Admin guard, plus `capability` when declared (403). |
| Webhook | `{METHOD} {prefix}/webhooks/plugins/{slug}{path}` | None. The plugin authenticates the sender. |

- Manifest paths may contain `:param` segments. Match them, send the values as
  `params`, and dispatch on the manifest path, not the request path.
- Only active plugins answer; anything else is a 404.
- Strip `Cookie`, `Authorization`, `X-XSRF-TOKEN`, `X-CSRF-TOKEN` and `Proxy-*`
  before a plugin sees the headers.
- A plugin's ordinary return value is JSON with 200. A handler that throws is a
  500 with a generic message; the error goes to the log, not the client.

## Hooks

### Actions: the canonical events

Every host delivers the canonical events of
[ADR 2026-10-21](../decisions/2026-10-21-event-vocabulary.md) to active
plugins' `actions`, under exactly those names, after the change is committed.
Legacy names are never delivered.

The payload carries both shapes the official plugins read:

| Events | Payload |
|---|---|
| `ticket.created`, `ticket.updated`, `ticket.resolved`, `ticket.closed`, `ticket.reopened`, `ticket.escalated`, `ticket.unassigned` | The ticket, flat, plus `ticket` (the same object). |
| `ticket.status_changed` | Ticket, flat, plus `ticket`, `old_status`, `new_status`. |
| `ticket.assigned` | Ticket, flat, plus `ticket`, `agent_id`. |
| `ticket.priority_changed` | Ticket, flat, plus `ticket`, `old_priority`, `new_priority`. |
| `ticket.department_changed` | Ticket, flat, plus `ticket`, `old_department_id`, `new_department_id`. |
| `ticket.tag_added`, `ticket.tag_removed` | Ticket, flat, plus `ticket`, `tag` (`{id, name, slug}`). |
| `reply.created`, `note.created` | The reply, flat, plus `reply` and `ticket`. |
| `sla.warning`, `sla.breached` | Ticket, flat, plus `ticket`, `type`. |
| `chat.*` | `{session}`: `session_id`, `ticket_id`, `status`, `agent_id`, `department_id`, plus the event's extras. Never the visitor's token or email. |

The ticket object is snake_case and carries at least `id`, `reference`,
`subject`, `title` (same as `subject`; the SDK's `Ticket` type reads `title`),
`status`, `priority`, `department_id`, `assigned_to`, `requester_id`,
`metadata`, `created_at`, `updated_at`.

Actions are fire-and-forget: a slow or failing plugin never fails or delays the
request that caused the event past the dispatch timeout (30 s on the bridge).
`ctx.emit(hook, data)` fires an action of the plugin's choosing to every
active plugin; hosts must not let an emitted name impersonate a canonical
event or a lifecycle action, so emitted names that collide are dropped.

Plugin `ctx` writes go through the ticket service, so they raise canonical
events while the plugin that wrote is still handling its action. Hosts guard
against a plugin re-triggering itself: while an action is being delivered to
plugins, the same action is not delivered to plugins again, and nesting stops
at three (Laravel's workflow re-entrancy guard, applied to plugin delivery).
Where delivery is deferred (after commit, `setImmediate`), the chain travels
with the event. Webhooks and workflows still see every event.

### Filters

`applyFilter(hook, value)` runs active plugins' `filters` in ascending
`priority` (default 10) and returns the result. A filter that throws or times
out (5 s) is skipped and the value carries on to the next one, as the runtime
does. This version of the contract requires no
particular filter point. A host lists the filter hooks it applies in its plugin
docs; Laravel applies `import.adapters`.

### Lifecycle actions

`plugin.activated`, `plugin.deactivated`, `plugin.uninstalling`, payload
`{plugin, slug}`. See [Lifecycle](#lifecycle).

## The plugin context (`ctx`)

Hosts implement the SDK's `PluginContext`. In-process hosts build the object;
bridge hosts answer the `ctx.*` RPC methods below. Every method is scoped to
the plugin being dispatched; a bridge host takes the plugin from the dispatch
it is serving and ignores a `plugin` parameter that names another.

| Method | Contract |
|---|---|
| `ctx.config.all` / `get(key)` / `set(data)` | The `__config__` row. `set` merges. |
| `ctx.store.get/set(collection, key[, value])` | One row by key. `set` upserts. |
| `ctx.store.query(collection, filter, options)` | Equality, `$gt $gte $lt $lte $ne $in $nin` on dotted field names matching `^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*$` (anything else is an error, never SQL). `options`: `limit`, `orderBy`, `order`. Returns `data` merged with `_id`. |
| `ctx.store.insert/update/delete` | `insert` takes `key` from `data.key`; `update` merges. |
| `ctx.tickets.find/query/create/update` | Through the host's ticket service, so events fire. `create` accepts only `subject`/`title`, `body`/`description`, `priority`, `status` (slug), `department_id`, `ticket_type`, `channel` (default `api`), `metadata`, and `contact_id` or `requester_email`/`requester_name` (a contact, found or created). `update` accepts the same minus channel and requester. `query` filters only on `id`, `reference`, `status`, `priority`, `channel`, `ticket_type`, `department_id`, `requester_id`, `contact_id`, `assigned_to`; any other key is an error, never a column name. Cap the rows (NestJS: 500). |
| `ctx.replies.find/query/create` | `create` takes only `ticket_id` (an existing ticket), `body` and `is_internal` (`true` makes a note). The author is the acting user (below), never a field. `query` filters on `ticket_id`, `is_internal`, `type`. |
| *write fields* | Every `create`/`update` (tickets, replies, contacts, tags) refuses a key outside its listed fields with an error naming it, before writing anything. Never mass-assign, and never drop unknown keys silently: a plugin that sends `author_id`, `requester_id`, `assigned_to`, `is_internal_note` or a user model's admin flag gets an error, not a write. |
| *acting user* | Writes act as the signed-in user of the request the plugin is serving, or as no user (0) outside a request. A plugin never names the actor or the requester id. A bridge host finds that request from the call's `host_call_id` (see [The SDK bridge](#the-sdk-bridge)). |
| `ctx.contacts.find/findByEmail/create` | `create` takes `name`, `email` only. |
| `ctx.tags.all/create`, `ctx.departments.all/find`, `ctx.agents.all/find` | Read models as the host's API serializes them. `ctx.tags.create` takes `name`, `slug`, `color`. |
| `ctx.broadcast.toChannel/toUser/toTicket` | Through the host's broadcaster, as event `event` with payload `data`; a no-op where it has none. Laravel's channels: `plugin.{channel}` (public), `private-user.{userId}` (that user's connections), `private-ticket.{ticketId}` (connections allowed to see the ticket). Hosts with their own realtime transport map these to its rooms with the same audiences. |
| `ctx.log` | The host log, with the plugin name attached. |
| `ctx.emit(hook, data)` | See [Actions](#actions-the-canonical-events). |
| `ctx.currentUser()` | The user of the request being served, or `null`. |
| `ctx.http` | Runs in the plugin's own process; not a host method. |

## The SDK bridge

For hosts that run `@escalated-dev/plugin-runtime`.

- **Spawn**: `node node_modules/@escalated-dev/plugin-runtime/build/bin/escalated-plugins.js`
  in the host's project directory, both configurable. Lazily, on first use.
- **Framing**: one JSON-RPC 2.0 message per line on stdin/stdout, at most
  10 MB. stderr is logs.
- **Handshake** first: send `{protocol_version: "1.0", host, host_version}`;
  refuse a runtime that does not answer `compatible: true`. Endpoint and
  webhook calls need `http_contract_versions` to contain `1`; otherwise answer
  them 503.
- **Host to runtime**: `handshake`, `manifest` (a map of name to manifest),
  `action {hook, event}`, `filter {hook, value}`,
  `endpoint {plugin, method, path, body, params, query, headers, ...}`,
  `webhook {...}`, `activate {plugin}`, `deactivate {plugin}`, `ping`,
  `cron {plugin, schedule}`, `badge {plugin, component}`.
- **Runtime to host**: the `ctx.*` methods above, which can arrive while the
  host waits for its own answer. Serve them in that wait.
- **Host call ids**: the runtime serves host calls concurrently. Every `ctx.*`
  call a plugin makes while handling a host call carries `host_call_id`, the
  JSON-RPC `id` of that host call (runtimes after 0.2.0, which also answer the
  handshake with `host_call_ids: true`). A host with several calls in flight
  uses it to find the call being served: its plugin(s) and its request, so the
  acting user and `ctx.currentUser` are that request's, never another's. A
  `ctx.*` call with an unknown or missing `host_call_id` acts for no user; a
  host may fall back to the only call in flight when there is exactly one (an
  older runtime). Hosts that serve one request per process (Laravel, Symfony)
  may ignore the field.
- **Timeouts**: handshake and manifest 15 s, action 30 s, filter 5 s, endpoint
  30 s, webhook 60 s.
- **Failure**: a dead runtime is restarted on next use with exponential backoff
  capped at 5 minutes. Meanwhile actions are dropped with a warning, filters
  return their input, and endpoints answer 503.
- **Activation**: the runtime loads every installed plugin. A bridge host
  must not send `endpoint`, `webhook`, `cron` or `badge` for an inactive
  plugin, and passes `plugins: [active names]` on `action` and `filter`.
  Runtimes that answer the handshake with `active_plugin_lists: true` run only
  the listed plugins' handlers (and accept the same list on `endpoint`,
  `webhook`, `cron` and `badge`); with an older runtime the host must still
  refuse an inactive plugin's `ctx.*` calls.

### Cron

The SDK's `cron` keys are five-field cron expressions
(`minute hour day-of-month month day-of-week`, evaluated in UTC), reported in
the manifest as `cronSchedules`. Once a minute, from the host's own scheduler,
send `cron {plugin, schedule}` for each **active** plugin and each of its
schedules that is due that minute (an in-process host calls
`cron[schedule](ctx)`). Each call runs with no acting user, under the action
timeout (30 s); a failing or slow schedule is logged and never stops the
others. An expression the host cannot parse is logged and skipped. No cron is
sent for an inactive plugin, or in tenant mode.

### Badges

A widget with a `badge` function (manifest `hasBadge: true`) gets a live count.
While building `dashboardWidgets` for a viewer, send `badge {plugin, component}`
for each such widget of an active plugin, as that viewer (acting user and
`ctx.currentUser`), under the filter timeout (5 s). Put the answer on the item
as `badge` (a number, a string or `null`); a failure or timeout is `null`.
Widgets without a badge function carry no `badge` key.

### Native plugins

Hosts with native plugins give them the same schedules and badges through an
optional hook, with the same rules (active plugins only, UTC, no user and 30 s
for cron; the viewer, 5 s and `null` on failure for badges; no `badge` key
without one): Go `plugins.CronPlugin` / `plugins.BadgePlugin`, Spring
`EscalatedPlugin.cron()` / `badges()`, .NET `IPluginCron` /
`IPluginWidgetBadges`, Symfony `CronPluginInterface` /
`WidgetBadgePluginInterface`. Laravel native widgets take a `badge` callable
(called with the viewer); Laravel native plugins schedule work with Laravel's
own scheduler.

## UI extensions

Shared on every Escalated page as `escalated.plugins`, built from **active**
plugins' manifests. This is the shape `usePluginExtensions()` reads:

| Key | Built from | Item |
|---|---|---|
| `menuItems` | `pages[].menu` | `{label, route: <page URL>, icon, position (default 100), section (default admin), plugin}` |
| `pageComponents` | `components[]` | Map of `"{page}.{slot}"` to `[{plugin, component, data: props, position: order}]` |
| `dashboardWidgets` | `widgets[]` | `{id: "{slug}.{component}", title: label, component, plugin, position: order, width: size}`, plus `badge` for a widget with a badge function (see [Badges](#badges)) |

`plugin` here is the **slug**: the frontend loads slot and widget components
from a directory named after it. An item with a `capability` the viewer lacks
is left out, and `admin` menu items go to admins only. With no active plugins,
send `escalated.plugins` as `{}`.

## Security

- **Who installs**: whoever deploys the host. Code-registered and
  package-managed plugins are added by changing the build; uploads (where a
  host allows them) need an admin. Activation, deactivation and uninstall need
  an admin.
- **Sandboxing**: an in-process plugin is trusted host code with the host's
  privileges. The runtime subprocess keeps plugin code out of the host's memory
  and database connection, but all SDK plugins share one Node process and the
  network, so it isolates the host from plugins, not plugins from each other.
  Store scoping by plugin name is a correctness guarantee, not a security
  boundary between plugins.
- **Tenant mode**: no plugin code runs when the host serves several tenants
  from one install. Hosts with tenant mode answer the admin plugin routes 403,
  register no plugin pages, endpoints or webhooks, and deliver no hooks, until
  the runtime can isolate tenants.
- **Inactive means inert**: no hooks, no routes (404), no UI extensions, no
  cron.
- **Secrets**: plugin config may hold API keys. Never serialize `ctx.config`
  into the Index page or the shared props.

## Known gaps

Recorded on 2026-10-29. Fix the backend, then strike the line.

- ~~Laravel shares `plugin_menu_items`, `plugin_dashboard_widgets` and
  `plugin_pages`; the frontend reads `escalated.plugins.*`.~~ Fixed in
  escalated-laravel #272.
- ~~Laravel delivers no canonical events to SDK plugins.~~ Fixed in
  escalated-laravel #272.
- ~~Laravel mounts SDK plugin routes on the raw name (`@scope/pkg`), not the
  slug.~~ Fixed in escalated-laravel #281.
- ~~Laravel's bridge never sends `activate`/`deactivate`, and dispatches to
  inactive SDK plugins.~~ Fixed in escalated-laravel #280 (and Rails #131,
  Adonis #216): SDK plugins are listed, activated and deactivated on
  Admin > Plugins, and hooks, cron, badges, UI extensions and routes reach
  active ones only. SDK plugins already installed the first time a host
  records them are kept active, so upgrades switch nothing off.
- ~~Adonis mounts endpoints at `{prefix}/plugins/{slug}/api/...` and webhooks at
  `{prefix}/plugins/{slug}/webhooks/...`.~~ Fixed in escalated-adonis #218,
  which also strips credential headers, runs endpoints as the signed-in user
  and answers a throwing handler 500 without its message.
- ~~Rails mounts SDK endpoints at `{prefix}/plugins/{name}/api/...` and webhooks
  at `{prefix}/plugins/{name}/webhooks/...` (the name with everything outside
  `[a-z0-9_-]` dropped), draws them with `Engine.routes.draw`, and has no SDK
  plugin pages.~~ Fixed in escalated-rails #133.
- ~~`@escalated-dev/plugin-runtime` ignores the `plugins` list on `action` and
  `filter`, so a bridge host cannot stop an inactive plugin's handler from
  running.~~ Fixed in escalated-plugin-runtime #9 (unreleased): it honours
  `plugins` on `action`, `filter`, `endpoint`, `webhook`, `cron` and `badge`
  and answers the handshake with `active_plugin_lists: true`. Until hosts
  require a runtime with it, Laravel and Rails still refuse an inactive
  plugin's `ctx.*` calls (except `ctx.log`).
- ~~Laravel's `ContextHandler` trusts a `plugin` parameter from the runtime.~~
  Fixed in escalated-laravel #281.
- ~~Laravel's `ctx.tickets.query` and `ctx.replies.query` use the filter's keys
  as column names~~ (fixed in escalated-laravel #272).
- ~~`ctx` writes mass-assign what the plugin sends.~~ Laravel (`replies.create`,
  `tags.create`; `tickets.create/update` dropped unknown keys and wrote a
  `body` column that does not exist), Rails, Django and Adonis (tickets,
  replies, contacts; Rails and Django tags too) let a plugin set a reply's
  author or note flag, a ticket's requester or assignee, or a host user's
  admin flag. Fixed in escalated-laravel #282, escalated-rails #135,
  escalated-django #129 and escalated-adonis #219: only the contract's fields,
  anything else an error. NestJS, Symfony, Go, .NET and Spring already picked
  fields explicitly (Go and Spring refuse unknown keys; NestJS, Symfony and
  .NET ignore them).
- ~~Laravel, Rails, Django and Adonis write plugin tickets and replies through
  the model, not the ticket service: model events fire, but ticket-service
  side effects (activity log, SLA attach) do not.~~ Fixed in escalated-laravel
  #284, escalated-rails #137, escalated-django #131 and escalated-adonis #221:
  `ctx.tickets.create/update` and `ctx.replies.create` go through the ticket
  service the API uses (status, priority and department changes as their own
  service calls, so each is checked, logged and announced), with the acting
  user as author and causer. While a plugin action is being delivered, the
  same action raised by a plugin's own write is not delivered to plugins
  again, and nesting stops at three (after Laravel's workflow re-entrancy
  guard); webhooks and workflows still see every event.

## Status by backend

| Backend | State (2026-10-29) |
|---|---|
| Laravel | Port of record, with the gaps above. |
| Rails, Django, Adonis, WordPress | Bridge plus native plugins; not yet checked against this doc. |
| Phoenix | Native plugins registered in config, `can_upload: false`; no SDK bridge. |
| NestJS | In-process SDK plugins, full contract (escalated-nestjs #193, #194). The reference for the ports below. |
| .NET, Spring, Symfony, Go | None yet. |

---

## Port test checklist

Through the host's real HTTP stack, with a stand-in SDK plugin (a
`definePlugin()` object, or a fake runtime for bridge hosts).

**Admin screen**

- [ ] GET `/admin/plugins` as admin renders `Escalated/Admin/Plugins/Index` with `plugins` and `can_upload`; each plugin object has `slug`, `name`, `version`, `is_active`, `source`.
- [ ] As an agent, a customer and a guest: refused, and the page is not rendered.
- [ ] Activate, then deactivate: 303 to the index, `success` flash, row state and timestamps; idempotent on repeat.
- [ ] Unknown slug: `error` flash (Inertia) or 404 (JSON); no row created.
- [ ] Uninstall a `registered` plugin: row gone, plugin still listed, inactive, store rows kept. A `composer` plugin: refused.
- [ ] `can_upload: false` hosts: POST `/admin/plugins/upload` is 404.
- [ ] Upload hosts: zip slip, missing `plugin.json` and an existing slug are refused.
- [ ] `onActivate`, `onDeactivate`, `plugin.activated`, `plugin.deactivated`, `plugin.uninstalling` fire in the documented order; a throwing callback does not undo the transition.

**Pages, endpoints, webhooks**

- [ ] An active plugin's page renders `Escalated/Plugin/Page` with `plugin`, `component`, `layout`, and `props` from `GET /{component}`, or `{}`.
- [ ] The same page for an inactive plugin, and for a non-admin: 404 and refused.
- [ ] A page or endpoint with a `capability` the user lacks: 403.
- [ ] An endpoint with `:id` in its path receives `params.id`, `query`, `body`, and no `cookie` or `authorization` header.
- [ ] A webhook answers without auth; an inactive plugin's webhook is a 404.
- [ ] A throwing endpoint is a 500 without the error message.

**Hooks and context**

- [ ] Creating a ticket over HTTP delivers `ticket.created` to an active plugin with the flat ticket and `ticket`; nothing to an inactive one.
- [ ] A reply delivers `reply.created` with `reply` and `ticket`; no legacy name is ever delivered.
- [ ] A plugin action that throws does not fail the request that fired it.
- [ ] Filters run in priority order, only for active plugins, and a throwing filter is skipped.
- [ ] `ctx.config.set` merges; `ctx.store.query` handles the operators and rejects a field name with SQL in it; one plugin cannot read another's rows through `ctx`.
- [ ] `escalated.plugins` carries `menuItems`, `pageComponents` and `dashboardWidgets` for active plugins only.
- [ ] A widget with a badge function carries the plugin's `badge` answer, asked as the viewer; a failing badge is `null`.
- [ ] A due cron schedule of an active plugin runs once for that minute; an undue one, or an inactive plugin's, does not.
- [ ] Bridge hosts: two plugin calls in flight at once, each from a different signed-in user, each see their own user in `ctx.currentUser` and as the actor of a write (`host_call_id`).

**Page-name parity**: take `Escalated/Admin/Plugins/Index` and
`Escalated/Plugin/Page` off the "not rendered yet" list.
