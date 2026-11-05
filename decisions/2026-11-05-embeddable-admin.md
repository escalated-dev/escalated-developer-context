# 2026-11-05: Escalated's admin can be embedded in the host's own admin panel (optional)

## Status

Accepted.

## Context

Escalated ships its own admin panel: a dark sidebar, a top bar and the admin
screens, mounted at `/{prefix}/admin` (`/support/admin` by default). Most hosts
already have an admin panel of their own (a Laravel/Inertia app with a sidebar,
a Rails or Django back office, a Blade or server-rendered admin, sometimes a
separate app on another origin). Their operators asked for one thing: show
Escalated's admin screens *inside* that panel, under its navigation, URL scheme
and authorization, instead of sending staff to a second admin with its own
chrome.

The shared frontend already has a layout hook:

```js
app.use(EscalatedPlugin, { layout: AppLayout, theme })
```

The host layout must accept a `#header` slot and a default slot. But
`EscalatedLayout.vue` only used it for **customer** pages: admin pages always
rendered Escalated's sidebar and agent pages always rendered `AgentShell`. The
frontend README claimed "all Escalated pages render inside it", which was never
true.

The owner's constraints:

- **Completely optional.** With no embed configuration every route, page, prop,
  layout, header and gate is exactly what it is today. The standalone admin
  stays the default and stays supported.
- **No auth weakening by default.** Escalated's admin gate stays in place
  unless the host explicitly opts in to replacing it with its own guards.
- **Stays Inertia-based.** No second rendering path for the admin screens.
- **Build on the existing `layout` contract** rather than invent a parallel
  frontend API.
- An **iframe** fallback for hosts whose admin is not Vue/Inertia, restricted
  to configured origins, with no open `postMessage`.

## Decision

Embedding is an install-level opt-in made of three independent parts. A host
uses whichever it needs.

1. **Backend: mount the admin under the host.** The admin routes move under a
   host prefix and host middleware, pages carry an embed flag, and a navigation
   prop describes the admin menu so the host can render it in its own sidebar.
2. **Frontend: render admin (and optionally agent) pages chrome-free inside the
   host's layout**, by extending the existing `layout` option with a scope.
3. **iframe fallback** for non-Vue hosts, with an origin allow-list on both the
   server (CSP `frame-ancestors`) and the client (`postMessage` origins).

Laravel is the reference implementation (escalated-laravel); the frontend is
escalated-dev/escalated. The other ten backends port this ADR (checklist
below).

### The three host types

| Host | What it uses | How Escalated's admin appears |
|---|---|---|
| **A. Vue + Inertia host** (same app, same Inertia instance) | backend embed (`mode: layout`) + frontend `layoutScope` / `layouts` | Each Escalated admin page renders inside the host's Vue admin layout; the host sidebar lists Escalated's menu from `escalated.navigation`. |
| **B. Server-rendered host** (Blade, ERB, Django templates, Twig, HEEx…) whose admin layout is a template | backend embed (`mode: layout`) + `root_view` | The host's admin template is the Inertia root view; it contains the host chrome and the Inertia mount point. Escalated renders chrome-free (title + content) inside it. The template renders the menu from the same navigation data (`Escalated::adminNavigation()` or the port's equivalent). |
| **C. Anything else** (separate app, other origin, non-Vue SPA, a CMS admin) | backend embed (`mode: iframe`) + `frame_ancestors` | The host puts an `<iframe>` on its admin page. Escalated renders chrome-free and speaks the postMessage protocol below (height, theme, navigation, active route). |

### Backend configuration (Laravel names; ports use the same keys in their idiom)

All under `escalated.ui.embed`. **Default: everything off.**

| Key | Env var | Default | Meaning |
|---|---|---|---|
| `enabled` | `ESCALATED_EMBED` | `false` | Master switch. While `false` nothing below has any effect. |
| `mode` | `ESCALATED_EMBED_MODE` | `'layout'` | `'layout'` (host types A and B) or `'iframe'` (host type C). |
| `prefix` | `ESCALATED_EMBED_PREFIX` | `'admin/support'` | URL prefix the admin routes are mounted under, instead of `{routes.prefix}/admin`. |
| `middleware` | — | `null` | Middleware for the embedded admin routes. `null` = `escalated.routes.admin_middleware` (today's `['web', 'auth']`). |
| `replace_admin_gate` | — | `false` | `true` drops Escalated's admin gate (`EnsureIsAdmin`) from the embedded routes, so the host's middleware (e.g. `can:admin`) is the only authority on who reaches the admin. Two-factor and route permissions still apply. |
| `layout` | — | `null` | Name of the host layout the frontend should wrap admin pages in (e.g. `'Layouts/AdminLayout'`); matched against the frontend plugin's `layouts` map. |
| `root_view` | — | `null` | Inertia root view for embedded admin responses (host type B). `null` = the host's normal root view. |
| `frame_ancestors` | `ESCALATED_EMBED_FRAME_ANCESTORS` (comma-separated) | `[]` | iframe mode only: origins allowed to frame the admin. Exact origins (`https://admin.example.com`); no wildcards, no `*`. |

Laravel also exposes the same thing as one call, made from a service provider's
`register()` method so it is in place before Escalated registers its routes:

```php
use Escalated\Laravel\Escalated;

Escalated::embedAdmin(
    prefix: 'admin/support',
    middleware: ['web', 'auth', 'can:admin'],
    layout: 'Layouts/AdminLayout',
    rootView: null,
    mode: 'layout',               // or 'iframe'
    replaceAdminGate: false,      // true = the host's middleware replaces Escalated's admin gate
    frameAncestors: [],           // iframe mode: ['https://admin.example.com']
);
```

`embedAdmin()` writes the config keys above and sets `enabled = true`; config
and the call are equivalent.

### What changes when `enabled` is true

**Routes.**

- Every route named `escalated.admin.*` that was mounted under
  `{routes.prefix}/admin` (the admin group, plugin admin routes, API-token
  routes) is mounted under `{embed.prefix}` instead, with
  `{embed.middleware} + tenancy middleware + [EnsureIsAdmin unless replace_admin_gate] + RequireTwoFactor + EnforceRoutePermissions + ApplyEmbedContext`.
- **Route names do not change.** The shared frontend builds admin URLs with
  `route('escalated.admin.…')`, so it follows the move. The standalone
  `{routes.prefix}/admin/...` URLs are not registered while embedding is on
  (one name, one URL).
- Unchanged: agent routes (`{routes.prefix}/agent`), customer, guest, widget,
  API, SSO, the two-factor enrolment page and challenge (personal, staff-wide,
  not admin-only), and the newsletter admin (`admin/newsletters`).
- `replace_admin_gate` only ever removes the admin gate from the *embedded
  admin* routes, and only when the host sets it. `is_admin` in shared props and
  the agent panel keep using Escalated's gates.

**Embedded responses** (`ApplyEmbedContext` middleware, on embedded routes only):

- Marks the request as embedded, so shared props carry `escalated.embed.enabled = true`.
- `root_view` set: sets the Inertia root view for that response.
- `mode = 'iframe'`: adds `Content-Security-Policy: frame-ancestors 'self' <origins…>`
  (`'self'` only when the list is empty) and removes any `X-Frame-Options`
  header from that response, since `frame-ancestors` is the stricter,
  allow-listed replacement. It does not touch any other route's headers.
- `mode = 'layout'`: no headers are added.

**Shared props** (added to the existing `escalated` shared prop; the keys are
absent while embedding is off, so nothing existing changes):

```jsonc
"escalated": {
  // ...every existing key, unchanged...
  "embed": {
    "enabled": true,              // true only on embedded admin responses; false on every other page
    "mode": "layout",             // "layout" | "iframe"
    "layout": "Layouts/AdminLayout", // or null
    "base_url": "/admin/support", // where the embedded admin lives (absolute path)
    "allowed_origins": []         // iframe mode: the frame_ancestors list; [] in layout mode
  },
  "navigation": [ /* NavigationItem[] — see below; [] for users who may not see the admin */ ]
}
```

`embed` and `navigation` are shared on **every** Inertia response while
embedding is on, including the host's own pages, so a host's sidebar can list
Escalated's admin menu on any page.

### Navigation item shape

```jsonc
{
  "key": "tickets",                    // stable id; plugin items: "plugin:<slug>:<n>"
  "label": "Tickets",                  // English label, same as the standalone sidebar
  "route": "escalated.admin.tickets.index", // route name, or null for plugin items with a raw URL
  "url": "/admin/support/tickets",     // absolute path (or plugin URL)
  "icon": "tickets",                   // icon key (see list); plugin items pass their own icon value
  "position": 20,                      // sort order, ascending, same numbers as the standalone sidebar
  "active": true,                      // current request URL equals url or is below it
  "badge": null,                       // plugin badge, else null
  "plugin": null,                      // plugin slug for plugin items, else null
  "children": []                       // plugin submenu items (same shape minus children)
}
```

Core items, in order (`key` = `icon`, then route name, position):

| key | route | position |
|---|---|---|
| `reports` | `escalated.admin.reports` | 10 |
| `tickets` | `escalated.admin.tickets.index` | 20 |
| `departments` | `escalated.admin.departments.index` | 30 |
| `sla-policies` | `escalated.admin.sla-policies.index` | 40 |
| `knowledge-base` | `escalated.admin.kb-articles.index` | 45 |
| `escalation-rules` | `escalated.admin.escalation-rules.index` | 50 |
| `workflows` | `escalated.admin.workflows.index` | 53 |
| `automations` | `escalated.admin.automations.index` | 53.5 |
| `webhooks` | `escalated.admin.webhooks.index` | 54 |
| `tags` | `escalated.admin.tags.index` | 60 |
| `custom-fields` | `escalated.admin.custom-fields.index` | 62 |
| `statuses` | `escalated.admin.statuses.index` | 64 |
| `canned-responses` | `escalated.admin.canned-responses.index` | 70 |
| `macros` | `escalated.admin.macros.index` | 80 |
| `newsletters` | `escalated.admin.newsletters.index` | 81 |
| `skills` | `escalated.admin.skills.index` | 82 |
| `users` | `escalated.admin.users.index` | 83 |
| `roles` | `escalated.admin.roles.index` | 84 |
| `capacity` | `escalated.admin.capacity.index` | 85 |
| `business-hours` | `escalated.admin.business-hours.index` | 86 |
| `audit-log` | `escalated.admin.audit-log` | 88 |
| `api-tokens` | `escalated.admin.api-tokens.index` | 90 |
| `custom-objects` | `escalated.admin.custom-objects.index` | 92 |
| `plugins` | `escalated.admin.plugins.index` | 95 |
| `import` | `escalated.admin.import.index` | 97 |
| `settings` | `escalated.admin.settings` | 100 |

Filtering, server-side, so a host sidebar never shows a link that would 403 or 404:

1. Not shown at all (empty list) to a user who fails Escalated's admin gate,
   unless `replace_admin_gate` is on (then the host decides who sees its
   sidebar, and the list is built for any signed-in user).
2. An item whose route is not registered is dropped (API tokens while the API
   is off, plugins while plugins are off, newsletters while they are off).
3. Feature switches: `roles` only while `access.roles_permissions` is on.
4. While roles & permissions is on, an item is dropped unless the user holds
   every permission its route requires (the port's `RoutePermissions` map,
   ADR 2026-10-29).
5. Plugin menu items with `section`/`target` `admin` are appended with the same
   filtering the plugin contract already applies (`permission` ability), then
   everything is sorted by `position`.

Laravel exposes the same list as `Escalated::adminNavigation(?Authenticatable $user = null, ?Request $request = null): array`
for server-rendered layouts (host type B).

### Frontend: extending the existing `layout` option

The existing option keeps its meaning. Two optional additions:

```js
app.use(EscalatedPlugin, {
    layout: AdminLayout,                    // existing: the host layout (#header + default slot)
    layoutScope: ['customer', 'admin'],     // NEW: which Escalated sections render inside it. Default ['customer'].
    layouts: { 'Layouts/AdminLayout': AdminLayout }, // NEW: named layouts the server may pick via escalated.embed.layout
    theme,
})
```

- **Only `layout` set (today's usage): behaviour is unchanged** — customer
  pages render inside it; admin pages render Escalated's sidebar; agent pages
  render `AgentShell`.
- A section in `layoutScope` renders **inside the host layout**:
  - `admin`: chrome-free. No Escalated sidebar, top bar, logo, "Back to App" or
    "Powered by". The page title goes into the host's `#header` slot, the page
    into the default slot, wrapped in an element that keeps the panel theme
    tokens (`--esc-panel-*`, `colorScheme`) so the screens look as designed.
  - `agent`: the agent workspace (`AgentShell`, with its queue rail, sections,
    search and palette, which are workspace content rather than app chrome)
    renders inside the host's default slot; its height is the existing
    `--esc-shell-height` hook, which the host sets to fit its layout.
- When the server says the page is embedded (`escalated.embed.enabled`), admin
  pages are treated as in scope even if `layoutScope` does not list `admin`, and
  the layout is chosen as: `layouts[embed.layout]` → `layout` → **no host
  layout** (chrome-free header + content only; this is host type B, where the
  host chrome is in the root view).
- `escalated.embed.mode === 'iframe'`: chrome-free with no host layout, plus the
  iframe bridge below.

Helpers for rendering the menu in the host's own sidebar (host type A):

- `useEscalatedNavigation()` → `{ items, activeItem, embed, isEmbedded }`
  (computed refs over `escalated.navigation` / `escalated.embed`).
- `<EscalatedNavigation />` — an accessible `<nav>` list of `Link`s with the
  icons, active state (`aria-current="page"`) and badges; unstyled beyond the
  panel tokens, with `class`/slot overrides so hosts can restyle it.
- `escalatedNavIcons` — the icon-key → SVG path map, for hosts drawing their own.

### iframe protocol (v1)

Every message is a plain object with `source` and `version: 1`. Messages from
Escalated have `source: 'escalated'`; messages from the host have
`source: 'escalated-host'`. Anything else is ignored.

Escalated (in the frame) → host:

| `type` | Fields | When |
|---|---|---|
| `ready` | `url`, `route`, `title` | after the first page mounts |
| `resize` | `height` (px, integer) | on mount and whenever the content height changes (ResizeObserver) |
| `navigate` | `url`, `route`, `title` | after every Inertia navigation — the host updates its active menu item / address bar |

Host → Escalated:

| `type` | Fields | Effect |
|---|---|---|
| `theme` | `mode` (`'light'`/`'dark'`), optional `tokens` (panel token map) | re-applies the panel theme |
| `navigate` | `url` | Inertia visit, **only** if `url` is a same-origin path under `embed.base_url` |

Security rules (all mandatory for ports):

- **Server:** iframe responses carry `frame-ancestors 'self' <allow-list>`. No
  allow-list = `'self'` only. Never `*`, never wildcards. Non-embedded routes
  are not touched.
- **Client, outgoing:** the bridge posts only to the parent's origin, and only
  when that origin is in `embed.allowed_origins` (taken from
  `location.ancestorOrigins[0]` where available, else the `document.referrer`
  origin). It never posts to `'*'`. If the parent's origin is not allowed, the
  bridge stays silent.
- **Client, incoming:** a message is handled only if `event.origin` is in the
  allow-list **and** `event.source === window.parent` **and** it has
  `source: 'escalated-host'`, `version: 1`. `navigate` URLs must be relative
  paths under `base_url` (no scheme, no `//`).
- The frontend ships a host-side helper, `connectEscalatedFrame(iframe, { origin, onNavigate, onResize })`,
  which applies the same checks in the other direction (accepts only messages
  from `origin` and from that iframe's `contentWindow`).
- **Cookies:** a frame on another *site* needs the session cookie sent in a
  third-party context: `SameSite=None; Secure` (Laravel:
  `SESSION_SAME_SITE=none`, `SESSION_SECURE_COOKIE=true`), served over HTTPS.
  Same-site frames (e.g. `admin.example.com` framing `support.example.com`)
  work with the default `Lax`. Browsers that block third-party cookies entirely
  will not keep the session in a cross-site frame; prefer host types A/B there.
  CSRF protection is unchanged.

## Consequences

- No change for any existing install: with `enabled = false` (the default) the
  route table, middleware, shared props, root view and headers are identical,
  and with only `layout` set the frontend renders exactly as before. Each
  backend proves this with tests (checklist below).
- Hosts that embed own the outer chrome (sidebar, header, user menu, logout).
  Escalated keeps owning the admin screens and their authorization.
- Hosts that set `replace_admin_gate` take responsibility for restricting the
  embedded admin; documentation must say so plainly.
- The agent panel stays at its standalone URL in v1 (the frontend builds 24
  agent URLs from the prefix). Agent pages may still render inside the host
  layout via `layoutScope: ['agent']`. Moving agent routes under the host
  prefix is a follow-up ADR if asked for.
- The README's "Layout Integration" section is corrected: `layout` applies to
  customer pages unless `layoutScope` says otherwise.

## Port checklist (each of the 10 other backends)

Config / API

- [ ] `ui.embed` keys with the names, defaults and env vars above, in the
      framework's config idiom. All off by default.
- [ ] An `embedAdmin(...)`-style call if the framework has a natural one
      (Rails initializer, Django setting, Nest module option, Adonis config,
      Symfony bundle config, Phoenix config, Go/.NET/Spring options struct,
      WordPress filter). Config alone is acceptable.
- [ ] `adminNavigation(user, request)` helper returning `NavigationItem[]`.

Routes

- [ ] With embed on: every `escalated.admin.*` route that lived under
      `{prefix}/admin` is mounted under `embed.prefix` with `embed.middleware`
      (or the default admin middleware), same route names / handlers.
- [ ] The standalone `{prefix}/admin` admin routes are not registered while
      embed is on.
- [ ] Admin gate kept unless `replace_admin_gate`; two-factor + route-permission
      middleware always kept.
- [ ] Agent, customer, guest, widget, API, SSO, two-factor and newsletter routes untouched.

Responses / props

- [ ] Embedded responses: `escalated.embed.enabled = true`; root view switch
      when `root_view` set; iframe mode adds `frame-ancestors` and strips
      `X-Frame-Options` on those responses only.
- [ ] `escalated.embed` + `escalated.navigation` shared while embed is on, on
      every Inertia response; absent while it is off.
- [ ] Navigation filtering: admin gate (or host gate), route exists, feature
      switches, `RoutePermissions` when roles & permissions is on, plugin admin
      menu items merged and sorted by `position`; `active` from the request path.

Tests (TDD; through the real router/HTTP stack)

- [ ] **Default unchanged:** with no embed config, `/{prefix}/admin/...` serves
      the admin with today's middleware; no `embed`/`navigation` props; no CSP
      or frame header changes; the route list for `escalated.admin.*` is identical.
- [ ] Embedded routes answer under the host prefix with the host middleware
      (e.g. a host-only middleware that sets a header or aborts runs); old URLs 404.
- [ ] Admin gate still refuses a non-admin when `replace_admin_gate` is off;
      the host middleware alone decides when it is on.
- [ ] `embed` prop shape; `navigation` shape, order, `active`, permission
      filtering (roles & permissions on, user lacking `settings.view` loses
      Settings), feature filtering, plugin item inclusion.
- [ ] `root_view` used on embedded responses only.
- [ ] iframe mode: `frame-ancestors 'self' https://allowed.example` on embedded
      responses, `X-Frame-Options` removed there, untouched elsewhere; layout
      mode adds no header.

Docs

- [ ] `docs/embedding-admin.md` in the port (template below), linked from the
      port README, describing embedding as an **optional alternative** to the
      default standalone admin.
- [ ] CHANGELOG `[Unreleased]` entry: "Optional: embed the admin in your own
      admin panel (off by default; no change unless configured)".

### `docs/embedding-admin.md` template for ports

```markdown
# Embedding the admin in your own admin panel (optional)

Escalated ships a standalone admin at `/<prefix>/admin`. That is the default
and needs no setup. If you already have an admin panel, you can instead show
Escalated's admin screens inside it. Nothing changes unless you turn this on.

## Pick your setup
| Your admin | Use |
|---|---|
| Vue + Inertia in this app | Layout embed (section 1) |
| Server-rendered templates (<framework templates>) | Root-view embed (section 2) |
| Anything else / another origin | iframe embed (section 3) |

## Configuration reference
<table of the ui.embed keys in this framework's syntax, env vars, defaults>

## 1. Vue + Inertia host
<backend config> → <frontend `app.use(EscalatedPlugin, { layout, layoutScope: ['admin'] })`>
→ <rendering `<EscalatedNavigation />` / `useEscalatedNavigation()` in the host sidebar>

## 2. Server-rendered host
<root view template containing the host chrome + the Inertia mount point>
→ <rendering adminNavigation() in the template>

## 3. iframe
<frame_ancestors> → <iframe markup + connectEscalatedFrame snippet>
→ <SameSite=None; Secure session cookie note, HTTPS, third-party cookie caveat>

## Security
- The admin gate stays on unless you set replace_admin_gate; if you do, your
  middleware is the only check — make sure it restricts to admins.
- iframe framing is limited to the origins you list; nothing else can frame it.

## What does not move
Agent panel, customer portal, widget, API, two-factor and newsletter URLs.

## Turning it off
Remove the config / call; the admin returns to `/<prefix>/admin`.
```

## Alternatives considered

- **A parallel frontend API (`embed: { layout }`)** next to `layout`. Rejected:
  `layout` already is the host-layout contract; a second option would split the
  docs and the behaviour. `layoutScope` extends it without changing its default.
- **Keep the standalone admin URLs alive while embedded.** Rejected: the shared
  frontend resolves admin URLs by route name, and one name can have one URL. Two
  admin entry points would also double the surface a host has to secure.
- **Always replace Escalated's admin gate with the host's middleware.**
  Rejected: an install could lose its admin check by adding `['web', 'auth']`.
  Replacing the gate is an explicit `replace_admin_gate` opt-in.
- **Web components / a separately bundled admin.** Rejected: a second rendering
  path for every admin screen; Inertia stays the one path.
- **`postMessage(..., '*')` for simplicity.** Rejected: leaks the active URL and
  page titles to any framing page and accepts navigation from anyone.
- **Moving the agent panel too in v1.** Deferred: the agent workspace builds its
  URLs from the prefix in 24 places; it can render in the host layout today and
  move later under a follow-up ADR.
