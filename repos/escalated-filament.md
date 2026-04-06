# escalated-filament

[![Tests](https://github.com/escalated-dev/escalated-filament/actions/workflows/run-tests.yml/badge.svg)](https://github.com/escalated-dev/escalated-filament/actions/workflows/run-tests.yml)

**Language**: PHP | **Framework**: Filament v3/4/5 + Laravel | **Package**: Composer

A Filament admin panel plugin that wraps `escalated-laravel`. Provides native Filament Resources, Pages, Widgets, and Actions for managing tickets -- without duplicating any business logic.

## How It Works

This package is a **UI layer only**. All business logic, models, services, events, and database operations come from `escalated-laravel`. Escalated Filament provides Filament-native components that call those same services.

This means:
- Same ticket lifecycle, SLA calculations, and escalation rules
- Same database tables and migrations (managed by escalated-laravel)
- Same events, notifications, and webhooks
- Native Filament look and feel (Livewire + Blade, not Vue + Inertia)

## Installation

```bash
composer require escalated-dev/escalated-laravel escalated-dev/escalated-filament
php artisan escalated:install
php artisan migrate
```

Register the plugin in your Filament panel:

```php
use Escalated\Filament\EscalatedPlugin;

$panel->plugin(EscalatedPlugin::make());
```

## Requirements

- PHP 8.2+
- Laravel 11 or 12
- Filament 3.x, 4.x, or 5.x
- escalated-dev/escalated-laravel ^0.5

## Directory Structure

```
src/
├── EscalatedPlugin.php     # Filament plugin registration
├── Resources/              # Filament Resources
│   ├── TicketResource.php
│   ├── DepartmentResource.php
│   ├── SlaResource.php
│   ├── TagResource.php
│   └── ...
├── Pages/                  # Filament Pages
│   ├── Dashboard.php
│   ├── Reports.php
│   └── Settings.php
├── Widgets/                # Filament Widgets
│   ├── TicketStatsWidget.php
│   ├── SlaBreachWidget.php
│   └── ...
├── Actions/                # Filament Actions
│   ├── AssignTicketAction.php
│   ├── ChangeStatusAction.php
│   └── ...
└── Infolists/              # Filament Infolists

resources/
└── views/                  # Blade views for custom components

tests/                      # Pest tests
```

## Authorization

Uses the same Laravel Gates as `escalated-laravel`:

```php
Gate::define('escalated-admin', fn ($user) => $user->is_admin);
Gate::define('escalated-agent', fn ($user) => $user->is_agent || $user->is_admin);
```

## Running Tests

```bash
vendor/bin/pest
```

Uses Pest with Livewire testing utilities.
