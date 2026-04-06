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

`Ticket`, `Reply`, `Department`, `Tag`, `SlaPolicy`, `EscalationRule`, `CannedResponse`, `Macro`, `Attachment`, `TicketActivity`, `AgentProfile`, `Skill`, `CustomField`, `CustomObject`, `Article`, `Automation`, `Webhook`, `ApiToken`, `Plugin`, `PluginStoreRecord`, `ImportJob`, `SatisfactionRating`, `SideConversation`, `BusinessSchedule`, `Holiday`, `Role`, `AuditLog`, `TwoFactor`
