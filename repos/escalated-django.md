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

## New Features

### Ticket Splitting

`TicketSplitService` splits a reply into a new linked ticket. Creates a `TicketLink` record and copies metadata.

### Ticket Snooze / Schedule

A `snoozed_until` field on the `Ticket` model tracks snooze times. Snoozed tickets are excluded from default querysets. A management command wakes expired snoozes:

```bash
python manage.py wake_snoozed_tickets
```

Should be scheduled via cron or Celery Beat.

### Email Threading and Branded Templates

Outbound emails include `In-Reply-To`, `References`, and `Message-ID` headers for threading. Django email templates use branded HTML with configurable logo, accent color, and footer via `EscalatedSetting`.

### Saved Views / Custom Queues

`SavedView` model and `SavedViewViewSet` (DRF) allow agents to create, update, and recall named filter presets. Views can be personal or shared.

### Embeddable Support Widget

`WidgetViewSet` provides API endpoints for the embeddable widget (KB search, ticket creation, status lookup). Configured via admin settings.

### Knowledge Base Toggle Settings

KB visibility, public/private access, and article feedback are controlled via `EscalatedSetting`. Middleware guards KB routes and returns 404 when disabled.

### Real-time Broadcasting

Core events are broadcast via Django Channels when `BROADCASTING.ENABLED` is `True`:

- `TicketCreatedConsumer`, `TicketUpdatedConsumer` -- broadcast to department/agent groups
- `ReplyCreatedConsumer` -- broadcast to ticket group
- `TicketAssignedConsumer`, `TicketEscalatedConsumer` -- broadcast to relevant agents

Configuration:

```python
ESCALATED = {
    'BROADCASTING': {
        'ENABLED': True,
        'BACKEND': 'channels',  # Django Channels
    },
}
```

### New Migrations

- Add `snoozed_until` to `escalated_tickets`
- Add `message_id` to `escalated_replies`
- Create `escalated_saved_views`
- Create `escalated_widget_configs`

## CI/CD

- **Linting**: Ruff, enforced via GitHub Actions on every push and PR.
