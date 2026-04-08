# escalated (frontend)

**Language**: Vue 3 + TypeScript | **Package**: npm (`@escalated-dev/escalated`)

The shared frontend component library used by all Inertia.js-based backend packages (Laravel, Django, Rails, AdonisJS, Phoenix, Symfony).

## Purpose

Provides the Vue 3 pages and components that render the Escalated UI. Every backend framework that uses Inertia.js delegates page rendering to this package, ensuring a consistent UI across all frameworks.

## Installation

```bash
npm install @escalated-dev/escalated
```

## How It Integrates

The host app's `app.ts` includes a page resolver that loads Escalated pages from `node_modules`:

```typescript
const escalatedPages = import.meta.glob(
    '../../node_modules/@escalated-dev/escalated/src/pages/**/*.vue',
);

createInertiaApp({
    resolve: (name) => {
        if (name.startsWith('Escalated/')) {
            const path = name.replace('Escalated/', '');
            return escalatedPages[`../../node_modules/@escalated-dev/escalated/src/pages/${path}.vue`]();
        }
        // ... resolve app pages normally
    },
});
```

The host app's Tailwind config must include the package's paths:

```javascript
content: [
    './node_modules/@escalated-dev/escalated/src/**/*.vue',
],
```

## Page Structure

```
src/
├── pages/
│   ├── Agent/
│   │   ├── Dashboard.vue       # Agent dashboard with stats and ticket queue
│   │   ├── TicketList.vue      # Filterable ticket list
│   │   ├── TicketShow.vue      # Ticket detail with replies, notes, activity
│   │   └── ...
│   ├── Customer/
│   │   ├── TicketList.vue      # Customer's own tickets
│   │   ├── TicketCreate.vue    # New ticket form
│   │   ├── TicketShow.vue      # Ticket detail (customer view)
│   │   └── ...
│   ├── Admin/
│   │   ├── Dashboard.vue       # Admin overview
│   │   ├── Departments.vue     # Department management
│   │   ├── SlaPolicies.vue     # SLA configuration
│   │   ├── EscalationRules.vue # Rule management
│   │   ├── Tags.vue            # Tag management
│   │   ├── Settings.vue        # App settings
│   │   └── ...
│   └── Guest/
│       ├── CreateTicket.vue    # Guest ticket form
│       └── ViewTicket.vue      # Guest ticket view (via token)
├── components/
│   ├── TicketReplyEditor.vue   # Rich text reply editor
│   ├── TicketFilters.vue       # Filter sidebar
│   ├── TicketTimeline.vue      # Activity timeline
│   ├── SlaCountdown.vue        # SLA timer display
│   ├── FileUploader.vue        # Drag-and-drop file upload
│   ├── TicketSplitDialog.vue   # Dialog for splitting a reply into a new ticket
│   ├── SnoozeButton.vue        # Snooze ticket until a future date/time
│   ├── SavedViewSidebar.vue    # Sidebar listing saved filter views (personal + shared)
│   ├── SaveViewDialog.vue      # Dialog for creating/editing a saved view
│   ├── EscalatedWidget.vue     # Embeddable support widget root component
│   └── ...
├── composables/                # Vue composables for shared logic
│   ├── useRealtime.ts          # WebSocket composable with polling fallback
│   └── ...
└── widget/
    └── entry.ts                # Standalone entry point for the embeddable widget
```

## New Components

### TicketSplitDialog

Allows agents to split a reply into a new, linked ticket. The dialog copies relevant metadata (tags, department, priority) and creates a `ticket_links` record between the original and new ticket.

### SnoozeButton

Dropdown button that lets agents snooze a ticket until a chosen date/time. Snoozed tickets are hidden from default queues and automatically wake up via a scheduled backend command.

### SavedViewSidebar / SaveViewDialog

Agents can save the current filter combination as a named view (personal or shared). `SavedViewSidebar` renders in the ticket list sidebar for quick access. `SaveViewDialog` handles create/edit of views.

### EscalatedWidget

Self-contained support widget for embedding on customer websites. Includes knowledge base search, ticket submission, and ticket status lookup. Configured via admin settings (accent color, position, greeting, departments).

The widget has a standalone build entry point at `widget/entry.ts` that produces a lightweight JS bundle loadable via `<script>` tag.

## useRealtime Composable

The `useRealtime` composable provides real-time event subscriptions using Laravel Echo (or equivalent WebSocket client). It gracefully falls back to polling when Echo/WebSocket is unavailable.

```typescript
import { useRealtime } from '@escalated-dev/escalated/composables/useRealtime'

const { subscribe, unsubscribe } = useRealtime()

// Subscribe to ticket updates
subscribe(`ticket.${ticketId}`, 'TicketUpdated', (event) => {
  // Handle real-time update
})
```

Supported events: `TicketCreated`, `TicketUpdated`, `ReplyCreated`, `TicketAssigned`, `TicketEscalated`.

## Styling

- Tailwind CSS utility classes
- Follows the host app's Tailwind theme (colors, fonts, spacing)
- Responsive design (mobile-friendly)
- Dark mode support via Tailwind's `dark:` variant

## Key Dependencies

- Vue 3
- Inertia.js (`@inertiajs/vue3`)
- Tailwind CSS
- Headless UI (for accessible dropdowns, modals, etc.)
- Tiptap (rich text editor)
- date-fns (date formatting)
- Laravel Echo (optional, for real-time WebSocket support)

## CI/CD

- **Linting**: ESLint + Prettier, enforced via GitHub Actions on every push and PR.
