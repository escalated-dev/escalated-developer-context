# Inertia.js Integration

How Escalated uses Inertia.js to share a single Vue 3 frontend across all backend frameworks.

## The Problem

Escalated supports 8+ backend frameworks. Building a separate frontend for each would be unsustainable. But each framework has its own templating and routing system (Blade, ERB, Jinja2, Edge, EEx, Twig, Go templates).

## The Solution: Inertia.js

Inertia.js is a protocol for server-driven SPAs. The server decides which page component to render and what props to pass. The client renders the component. This means:

- **One set of Vue 3 components** serves all frameworks
- **Server handles routing, auth, and validation** -- no client-side router
- **No REST API needed for UI** -- props are passed directly from controllers

## How It Works

### Server Side

Each controller returns an Inertia response specifying a page component and props:

```php
// Laravel
return Inertia::render('Escalated/Agent/TicketShow', [
    'ticket' => $ticket->toArray(),
    'departments' => Department::all(),
    'canAssign' => Gate::allows('escalated-agent'),
]);
```

```python
# Django
return inertia.render(request, 'Escalated/Agent/TicketShow', {
    'ticket': ticket.to_dict(),
    'departments': list(Department.objects.values()),
    'canAssign': is_agent(request.user),
})
```

```ruby
# Rails
render inertia: 'Escalated/Agent/TicketShow', props: {
  ticket: ticket.as_json,
  departments: Department.all.as_json,
  canAssign: current_user.agent?,
}
```

### Client Side

The host app's `app.ts` resolves page components. Escalated pages live in the npm package:

```typescript
import { createInertiaApp } from '@inertiajs/vue3'

const escalatedPages = import.meta.glob(
    '../../node_modules/@escalated-dev/escalated/src/pages/**/*.vue',
)

createInertiaApp({
    resolve: (name) => {
        if (name.startsWith('Escalated/')) {
            const path = name.replace('Escalated/', '')
            return escalatedPages[
                `../../node_modules/@escalated-dev/escalated/src/pages/${path}.vue`
            ]()
        }
        // Resolve your own app's pages normally
        return resolvePageComponent(
            `./Pages/${name}.vue`,
            import.meta.glob('./Pages/**/*.vue')
        )
    },
    // ...
})
```

### Tailwind Integration

The host app's Tailwind config must include the Escalated package so its utility classes are not purged:

```javascript
// tailwind.config.js
content: [
    './resources/**/*.{vue,js,ts}',  // Your app's files
    './node_modules/@escalated-dev/escalated/src/**/*.vue',  // Escalated
],
```

## Inertia Adapters by Framework

| Framework | Adapter Package | Status |
|-----------|----------------|--------|
| Laravel | `inertiajs/inertia-laravel` | Official, mature |
| Django | `inertia-django` | Community, stable |
| Rails | `inertia_rails` | Community, stable |
| AdonisJS | `@adonisjs/inertia` | Official AdonisJS package |
| Phoenix | `inertia_phoenix` | Community |
| Symfony | `rompetomp/inertia-bundle` | Community |
| Go | Custom implementation | Minimal, built-in |
| WordPress | Not used | WordPress uses its own admin UI |

## Page Component Convention

All Escalated page components follow this naming pattern:

```
Escalated/{Role}/{PageName}
```

Examples:
- `Escalated/Agent/Dashboard`
- `Escalated/Agent/TicketShow`
- `Escalated/Customer/TicketList`
- `Escalated/Customer/TicketCreate`
- `Escalated/Admin/Departments`
- `Escalated/Admin/Settings`
- `Escalated/Guest/CreateTicket`

## Shared Props

Escalated uses Inertia's shared data to pass common props to every page:

- `auth.user` -- Current user info
- `escalated.version` -- Package version
- `escalated.settings` -- App-level settings
- `escalated.permissions` -- Current user's permissions
- `escalated.unreadCount` -- Unread ticket count (for badges)

## Without Inertia

If the framework does not have an Inertia adapter, or if a team prefers not to use Inertia:

1. Set `ui_enabled = false` to go headless
2. Build a custom frontend against the REST API
3. Or implement a custom `EscalatedUiRenderer` that renders pages using the framework's native template engine

See the [UI-Optional Pattern](ui-optional-pattern.md) guide for details.
