# escalated-django

[![Tests](https://github.com/escalated-dev/escalated-django/actions/workflows/run-tests.yml/badge.svg)](https://github.com/escalated-dev/escalated-django/actions/workflows/run-tests.yml)

**Language**: Python | **Framework**: Django 4.2+ | **Package**: pip

Django implementation of Escalated. Installable as a Django app via pip. Structurally aligned with the Laravel package -- same services, same driver pattern, same UI.

## Installation

```bash
pip install escalated-django
npm install @escalated-dev/escalated
```

Add `'escalated'` to `INSTALLED_APPS`, include URLs, run migrations.

## Directory Structure

```
escalated/                  # Django app
├── models/                 # Django models (Ticket, Reply, Department, etc.)
├── views/                  # Views grouped by role (agent/, admin/, customer/, api/)
├── services/               # Service classes mirroring Laravel's service layer
├── drivers/                # LocalDriver, SyncedDriver, CloudDriver
├── serializers/            # DRF serializers for API views
├── forms/                  # Django forms for validation
├── signals/                # Django signals (ticket_created, etc.)
├── middleware/             # Auth middleware for agent/admin checks
├── bridge/                 # Plugin runtime bridge
├── management/commands/    # Django management commands
├── migrations/             # Django migrations
├── templates/              # Templates (minimal -- Inertia handles most UI)
├── urls.py                 # URL configuration
├── apps.py                 # App config
└── admin.py                # Django admin registration (optional)

plugins/                    # Plugin utilities
stubs/                      # Template stubs
tests/                      # pytest tests
docs/                       # Documentation
```

## Configuration

Settings via `ESCALATED` dict in `settings.py`:

```python
ESCALATED = {
    'MODE': 'self-hosted',
    'USER_MODEL': 'auth.User',
    'ROUTE_PREFIX': 'support',
    'UI_ENABLED': True,
    'HOSTED': {
        'API_URL': 'https://cloud.escalated.dev/api/v1',
        'API_KEY': None,
    },
    'SLA': {
        'ENABLED': True,
        'BUSINESS_HOURS_ONLY': False,
    },
}
```

## Routes

```python
urlpatterns = [
    path("support/", include("escalated.urls")),
]
```

Routes mirror the Laravel package: customer, agent, admin, API, guest, inbound.

## Authorization

Uses callables configured in settings:

```python
ESCALATED = {
    'ADMIN_CHECK': lambda user: user.is_staff,
    'AGENT_CHECK': lambda user: hasattr(user, 'is_agent') and user.is_agent,
}
```

## UI Rendering

Uses `inertia-django` for Inertia.js protocol. The `render_page(request, page, props)` function abstracts page rendering. When `UI_ENABLED` is `False`, only API routes are active.

## Running Tests

```bash
pytest
```

Uses pytest-django with SQLite in-memory.
