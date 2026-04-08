# escalated-symfony

**Language**: PHP | **Framework**: Symfony 6.4/7.x | **Package**: Composer bundle

Symfony bundle implementation of Escalated.

## Installation

```bash
composer require escalated-dev/escalated-symfony
```

If Symfony Flex is installed, the bundle auto-registers. Otherwise add to `config/bundles.php`.

## Requirements

- PHP 8.2+
- Symfony 6.4 or 7.x
- Doctrine ORM 2.17+ / 3.x
- Doctrine Migrations Bundle

## Configuration

```yaml
# config/packages/escalated.yaml
escalated:
    user_class: App\Entity\User
    route_prefix: /support
    ui_enabled: true
    table_prefix: escalated_
    tickets:
        allow_customer_close: true
        default_priority: medium
    sla:
        enabled: true
        business_hours_only: false
        business_hours:
            start: '09:00'
            end: '17:00'
            timezone: UTC
            days: [1, 2, 3, 4, 5]
```

## Directory Structure

```
src/
├── Controller/             # Controllers grouped by role
│   ├── Admin/
│   ├── Agent/
│   ├── Api/
│   ├── Customer/
│   └── Guest/
├── Entity/                 # Doctrine entities
├── Repository/             # Doctrine repositories
├── Service/                # Service classes
├── Driver/                 # LocalDriver, SyncedDriver, CloudDriver
├── Bridge/                 # Plugin runtime bridge
├── Event/                  # Symfony events
├── EventSubscriber/        # Event subscribers
├── Security/               # Voters for authorization
├── DependencyInjection/    # Bundle extension and configuration
└── EscalatedBundle.php     # Bundle class

config/
├── routes.yaml             # Route definitions
└── services.yaml           # Service definitions

migrations/                 # Doctrine migrations
tests/                      # PHPUnit tests
```

## Database Tables

All tables prefixed with `escalated_`: `escalated_tickets`, `escalated_replies`, `escalated_departments`, `escalated_tags`, `escalated_sla_policies`, `escalated_ticket_activities`, `escalated_agent_profiles`, etc.

## Authorization

Uses Symfony Voters:

```php
#[IsGranted('ESCALATED_ADMIN')]
public function adminDashboard(): Response { ... }
```

Security voters check against the configured `user_class`.

## UI Rendering

Supports Inertia.js via `inertia-symfony-bundle`. When `ui_enabled: false`, only API routes are active.

## Running Tests

```bash
vendor/bin/phpunit
```

## New Features

### Ticket Splitting

`TicketSplitService` splits a reply into a new linked ticket. Creates a `TicketLink` entity and copies metadata.

### Ticket Snooze / Schedule

A `snoozedUntil` column on the `Ticket` entity tracks snooze times. Snoozed tickets are excluded from default repository queries. A Console command wakes expired snoozes:

```bash
bin/console escalated:wake-snoozed-tickets
```

Should be scheduled via Symfony Scheduler or cron.

### Email Threading and Branded Templates

Outbound emails include `In-Reply-To`, `References`, and `Message-ID` headers. Twig email templates use branded HTML with configurable logo, accent color, and footer via `escalated_settings`.

### Saved Views / Custom Queues

`SavedView` entity and `SavedViewController` allow agents to save/recall named filter presets (personal or shared).

### Embeddable Support Widget

`WidgetController` provides API endpoints for the embeddable widget. Configured via admin settings.

### Knowledge Base Toggle Settings

KB visibility, public/private access, and article feedback are controlled via settings. Routes are guarded by an EventSubscriber that checks KB settings and returns 404 when disabled.

### Real-time Broadcasting

Core events are broadcast via Mercure when `broadcasting.enabled` is `true`:

- `TicketCreatedEvent`, `TicketUpdatedEvent` -- published to department/agent topics
- `ReplyCreatedEvent` -- published to the ticket topic
- `TicketAssignedEvent`, `TicketEscalatedEvent` -- published to agent topics

Configuration:

```yaml
escalated:
    broadcasting:
        enabled: true
        driver: mercure
```

### New Migrations

- Add `snoozed_until` to `escalated_tickets`
- Add `message_id` to `escalated_replies`
- Create `escalated_saved_views`
- Create `escalated_widget_configs`

## CI/CD

- **Linting**: PHP-CS-Fixer, enforced via GitHub Actions on every push and PR.
