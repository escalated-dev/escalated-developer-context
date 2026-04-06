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
