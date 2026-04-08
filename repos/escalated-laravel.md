# escalated-laravel

[![Tests](https://github.com/escalated-dev/escalated-laravel/actions/workflows/laravel.yml/badge.svg)](https://github.com/escalated-dev/escalated-laravel/actions/workflows/laravel.yml)

**Language**: PHP | **Framework**: Laravel 11-13 | **Package**: Composer

The primary and most mature Escalated backend package. Provides the full helpdesk as a Laravel package installable via Composer.

## Installation

```bash
composer require escalated-dev/escalated-laravel
npm install @escalated-dev/escalated
php artisan escalated:install
php artisan migrate
```

## Directory Structure

```
src/
├── Bridge/                 # Plugin runtime bridge (spawns Node.js process)
├── Console/                # Artisan commands (escalated:install, etc.)
├── Contracts/              # Interfaces
│   ├── EscalatedUiRenderer.php  # UI abstraction
│   ├── HasTickets.php           # Trait for User model
│   ├── ImportAdapter.php        # Data import interface
│   ├── TicketDriver.php         # Driver interface (core abstraction)
│   └── Ticketable.php           # Interface for User model
├── Drivers/                # Three hosting mode implementations
│   ├── CloudDriver.php
│   ├── LocalDriver.php
│   └── SyncedDriver.php
├── Enums/                  # PHP 8.1 enums (TicketStatus, TicketPriority, etc.)
├── Escalated.php           # Main entry class
├── EscalatedManager.php    # Driver manager (resolves active driver from config)
├── EscalatedServiceProvider.php  # Service provider (boot + register)
├── Events/                 # Domain events (TicketCreated, StatusTransitioned, etc.)
├── Facades/                # Laravel facades
├── Http/                   # Controllers, middleware, requests
│   ├── Controllers/
│   │   ├── Admin/          # Admin panel controllers
│   │   ├── Agent/          # Agent dashboard controllers
│   │   ├── Api/            # REST API controllers
│   │   ├── Customer/       # Customer portal controllers
│   │   └── Guest/          # Guest ticket controllers
│   ├── Middleware/
│   └── Requests/           # Form request validation
├── Listeners/              # Event listeners
├── Mail/                   # Mailable classes
├── Models/                 # Eloquent models (40+ models)
├── Notifications/          # Notification classes
├── Policies/               # Authorization policies
├── Services/               # Business logic (20+ services)
├── Support/                # Helpers, utilities
├── Traits/                 # Reusable traits
└── UI/
    └── InertiaUiRenderer.php  # Default UI renderer (Inertia.js)

config/
└── escalated.php           # Package configuration

database/
└── migrations/             # 35+ migrations (all prefixed escalated_)

routes/
├── admin.php               # Admin panel routes
├── agent.php               # Agent dashboard routes
├── api.php                 # REST API routes (Bearer auth)
├── customer.php            # Customer portal routes
├── guest.php               # Guest ticket routes
├── inbound.php             # Inbound email webhook routes
└── plugins.php             # Plugin endpoint routes

resources/                  # Blade views (used by InertiaUiRenderer)
stubs/                      # Publishable stubs
tests/                      # Pest tests
```

## Configuration

`config/escalated.php` controls all behavior:

- `mode` -- Hosting mode (`self-hosted`, `synced`, `cloud`)
- `user_model` -- Host app's User model class
- `hosted.api_url` / `hosted.api_key` -- Cloud API connection
- `routes.prefix` -- URL prefix (default: `support`)
- `routes.middleware` -- Middleware stack for routes
- `ui.enabled` -- Enable/disable Inertia UI
- `tickets.*` -- Ticket behavior (allow_customer_close, default_priority, etc.)
- `sla.*` -- SLA engine config (enabled, business_hours_only, schedule)
- `attachments.*` -- File upload limits and allowed types
- `notifications.*` -- Email notification preferences
- `plugins.*` -- Plugin runtime configuration
- `broadcasting.*` -- Real-time broadcasting config (enabled, driver)
- `email.branding.*` -- Email template branding (logo URL, accent color, footer text)
- `email.threading` -- Enable In-Reply-To/References/Message-ID headers for email threading
- `knowledge_base.enabled` -- Enable/disable KB
- `knowledge_base.public` -- KB visibility (public or authenticated-only)
- `knowledge_base.feedback` -- Enable/disable helpful/not-helpful feedback on articles
- `widget.*` -- Embeddable widget settings (enabled, color, position, greeting, departments)

## Routes

All routes are prefixed with the configured prefix (default: `/support`).

| Group | Prefix | Middleware | Purpose |
|-------|--------|------------|---------|
| Customer | `/support` | web, auth | Customer ticket portal |
| Agent | `/support/agent` | web, auth, escalated-agent | Agent dashboard |
| Admin | `/support/admin` | web, auth, escalated-admin | Admin settings |
| API | `/support/api/v1` | api, escalated-api-auth | REST API |
| Guest | `/support/guest` | web | Guest ticket access |
| Inbound | `/support/inbound` | (webhook signature) | Email webhooks |
| Widget | `/support/widget` | (CORS, throttle) | Embeddable widget API |

## Authorization

Uses Laravel Gates:

```php
Gate::define('escalated-admin', fn ($user) => $user->is_admin);
Gate::define('escalated-agent', fn ($user) => $user->is_agent || $user->is_admin);
```

## User Model Integration

The host app's User model implements `Ticketable` and uses the `HasTickets` trait:

```php
class User extends Authenticatable implements Ticketable
{
    use HasTickets;
}
```

This provides `$user->tickets()`, `$user->assignedTickets()`, and other relationship methods.

## UI Rendering

The default `InertiaUiRenderer` renders Vue 3 pages from `@escalated-dev/escalated`. The host app's `app.ts` must include a page resolver for `Escalated/*` components.

To go headless, set `ui.enabled = false`. Only API routes, commands, events, and the plugin runtime will be active.

## Plugin Integration

The `Bridge/` directory contains the PHP side of the plugin runtime communication. The `PluginService` manages plugin lifecycle. `HookRegistry` dispatches action and filter hooks.

## Running Tests

```bash
vendor/bin/pest
```

Tests use SQLite in-memory. The test suite covers services, controllers (feature tests), API endpoints, and driver behavior.

## Key Models

`Ticket`, `Reply`, `Department`, `Tag`, `SlaPolicy`, `EscalationRule`, `CannedResponse`, `Macro`, `Attachment`, `TicketActivity`, `AgentProfile`, `Skill`, `CustomField`, `CustomObject`, `Article`, `Automation`, `Webhook`, `ApiToken`, `Plugin`, `PluginStoreRecord`, `ImportJob`, `SatisfactionRating`, `SideConversation`, `BusinessSchedule`, `Holiday`, `Role`, `AuditLog`, `TwoFactor`, `SavedView`, `WidgetConfig`

## New Features

### Ticket Splitting

The `TicketSplitService` allows agents to split a reply into a new ticket. The new ticket is linked to the original via `escalated_ticket_links` and copies metadata (tags, department, priority). Accessible from the reply context menu in the agent UI.

### Ticket Snooze / Schedule

Agents can snooze a ticket until a future date. Snoozed tickets are excluded from default queues via a `snoozed_until` column on `escalated_tickets`. The `escalated:wake-snoozed-tickets` Artisan command runs on a schedule (typically every minute via `schedule:run`) to automatically re-open snoozed tickets whose snooze time has passed.

```bash
php artisan escalated:wake-snoozed-tickets
```

### Email Threading and Branded Templates

Outbound notification emails now include `In-Reply-To`, `References`, and `Message-ID` headers so replies thread correctly in email clients. All notification emails use branded HTML templates configurable via admin settings:

- `email.branding.logo_url` -- Logo displayed in email header
- `email.branding.accent_color` -- Primary accent color (hex)
- `email.branding.footer_text` -- Custom footer text

### Saved Views / Custom Queues

The `SavedViewController` and `SavedView` model allow agents to save filter presets as named views. Views can be personal or shared with the team. The frontend renders these in a sidebar for quick queue navigation.

### Embeddable Support Widget

The `WidgetController` serves the widget API endpoints (KB search, ticket creation, ticket status lookup). Widget behavior is configured in admin settings (accent color, position, greeting message, allowed departments). The widget frontend is a standalone JS bundle from the `@escalated-dev/escalated` package.

### Knowledge Base Toggle Settings

KB visibility and feedback are controlled via `escalated_settings`:

- `knowledge_base.enabled` -- Master toggle for the entire KB
- `knowledge_base.public` -- When false, only authenticated users can access articles
- `knowledge_base.feedback` -- Toggle helpful/not-helpful voting on articles

Routes are guarded by middleware that checks these settings and returns 404 when the KB is disabled.

### Real-time Broadcasting

When `broadcasting.enabled` is `true`, core events are broadcast via Laravel's broadcasting system (Pusher, Ably, Reverb, etc.):

- `TicketCreated`, `TicketUpdated` -- broadcast to department and assigned agent channels
- `ReplyCreated` -- broadcast to the ticket channel
- `TicketAssigned` -- broadcast to the assigned agent
- `TicketEscalated` -- broadcast to the escalation target

Events implement `ShouldBroadcast` and are dispatched alongside existing domain events. Broadcasting is opt-in and has zero impact when disabled.

### New Controllers

- `WidgetController` -- Widget API (KB search, ticket submit, status lookup)
- `SavedViewController` -- CRUD for saved filter views

### New Migrations

- Add `snoozed_until` column to `escalated_tickets`
- Add `message_id` column to `escalated_replies` (for email threading)
- Create `escalated_saved_views` table
- Create `escalated_widget_configs` table

## CI/CD

- **Linting**: Laravel Pint, enforced via GitHub Actions on every push and PR.
