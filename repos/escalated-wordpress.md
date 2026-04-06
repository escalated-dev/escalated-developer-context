# escalated-wordpress

[![Tests](https://github.com/escalated-dev/escalated-wordpress/actions/workflows/run-tests.yml/badge.svg)](https://github.com/escalated-dev/escalated-wordpress/actions/workflows/run-tests.yml)

**Language**: PHP | **Framework**: WordPress 6.0+ | **Package**: WordPress plugin

WordPress plugin implementation of Escalated. Unlike the Inertia-based packages, WordPress uses its own admin UI (wp-admin screens) and shortcodes for the customer-facing frontend.

## Installation

1. Place the plugin in `wp-content/plugins/escalated`
2. Activate from the WordPress Plugins screen
3. Configure via the Escalated admin menu

Or download `escalated.zip` from the latest GitHub release.

## Requirements

- WordPress 6.0+
- PHP 8.1+

## Directory Structure

```
escalated.php               # Plugin entry point (registers hooks, activation)
uninstall.php               # Cleanup on plugin deletion

includes/
├── class-escalated-*.php   # Core classes (Tickets, Departments, SLA, etc.)
├── admin/                  # wp-admin screens and settings
├── api/                    # REST API endpoints (Bearer token auth)
├── services/               # Service classes (mirroring other packages)
└── inbound/                # Inbound email processing

templates/
├── shortcodes/             # Customer-facing shortcode templates
└── emails/                 # Email notification templates

assets/
├── css/                    # Admin and frontend CSS
└── js/                     # Admin and frontend JavaScript

languages/                  # i18n (.pot, .po, .mo files)
screenshots/                # Auto-generated Playwright screenshots
tests/                      # PHPUnit tests with WP_UnitTestCase
scripts/                    # Build and CI scripts
```

## Key Differences from Other Packages

1. **No Inertia.js** -- WordPress uses its own admin UI framework (wp-admin, settings API) and shortcodes for the frontend
2. **Custom roles** -- Creates `escalated_admin` and `escalated_agent` WordPress roles
3. **Shortcodes** -- Customer-facing pages use WordPress shortcodes:
   - `[escalated_tickets]` -- Ticket list
   - `[escalated_create_ticket]` -- New ticket form
   - `[escalated_view_ticket]` -- Ticket detail
   - `[escalated_guest_create]` -- Guest ticket form
4. **Settings stored in wp_options** -- Not env vars or config files
5. **No driver pattern** -- WordPress is self-hosted only (no cloud/synced modes)

## REST API

Bearer token authentication:

```
GET /wp-json/escalated/v1/tickets
Authorization: Bearer esc_live_...
```

API endpoints: tickets, replies, departments, tags, SLA policies, agents, reports.

## Authorization

Uses WordPress capabilities:

```php
current_user_can('escalated_admin')
current_user_can('escalated_agent')
```

Custom roles are created on plugin activation.

## Features

- Ticket management with threaded conversations, internal notes, activity timeline
- Department-based routing and round-robin assignment
- SLA policies with first-response and resolution targets
- Automated escalation rules and scheduled SLA checks
- Inbound email via Mailgun, Postmark, Amazon SES webhooks
- Canned responses, macros, tag management
- Satisfaction ratings and reporting
- Guest ticket submission
- File attachments
- Automations

## Running Tests

```bash
vendor/bin/phpunit
```

Requires WordPress test library setup (MySQL database). See `phpunit.xml.dist`.

## Screenshots

Screenshots are auto-generated via Playwright on every release. See `.github/workflows/screenshots.yml`. Stored in `screenshots/results/`.
