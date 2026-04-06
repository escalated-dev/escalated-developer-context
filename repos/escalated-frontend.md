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
│   └── ...
└── composables/                # Vue composables for shared logic
```

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
