# Repository Overview

Complete map of all Escalated repositories.

## Platform Features

All backend framework packages implement the following core features:

- Ticket management (create, update, assign, close, merge, split)
- Ticket splitting -- split a reply into a new linked ticket
- Ticket snooze/schedule -- snooze tickets until a future date, auto-wake via scheduled command
- Replies (public, internal notes, system messages)
- Departments and tags
- SLA policies with per-priority response/resolution targets and business hours
- Escalation rules (condition-based automation)
- Agent assignment (manual, round-robin, capacity-based, skill-based)
- Knowledge base with toggle settings (enable/disable, public/private, feedback on/off)
- Saved views / custom queues -- agents can save filter presets as named views (personal or shared)
- Embeddable support widget -- JS widget for customer websites (KB search, ticket submission, status lookup)
- Email threading -- outbound emails include In-Reply-To/References/Message-ID headers
- Branded email templates -- configurable logo, accent color, and footer
- Real-time broadcasting -- opt-in WebSocket/SSE broadcasting for core events with frontend polling fallback
- Canned responses and macros
- Custom fields and custom objects
- Satisfaction ratings (CSAT)
- File attachments
- REST API with Bearer token auth
- Inbound email processing (Mailgun, Postmark, SES, IMAP)
- Data import (Zendesk, Freshdesk, Intercom, Help Scout)
- Plugin system (actions, filters, endpoints, webhooks, cron, UI extensions)
- Three hosting modes (self-hosted, synced, cloud)
- Headless/UI-optional mode

## Backend Framework Packages

These are the core products -- each embeds Escalated into a specific backend framework.

| Repo | GitHub | Language | Framework | Purpose | Requirements |
|------|--------|----------|-----------|---------|--------------|
| escalated-laravel | [escalated-dev/escalated-laravel](https://github.com/escalated-dev/escalated-laravel) | PHP | Laravel 11-13 | Composer package | PHP 8.2+, Node 18+ |
| escalated-django | [escalated-dev/escalated-django](https://github.com/escalated-dev/escalated-django) | Python | Django 4.2+ | pip package | Python 3.10+, Node 18+ |
| escalated-rails | [escalated-dev/escalated-rails](https://github.com/escalated-dev/escalated-rails) | Ruby | Rails 7.1+ | Gem (engine) | Ruby 3.1+, Node 18+ |
| escalated-adonis | [escalated-dev/escalated-adonis](https://github.com/escalated-dev/escalated-adonis) | TypeScript | AdonisJS v6 | npm package | Node 20+ |
| escalated-phoenix | [escalated-dev/escalated-phoenix](https://github.com/escalated-dev/escalated-phoenix) | Elixir | Phoenix | Hex package | Elixir 1.15+, Node 18+ |
| escalated-symfony | [escalated-dev/escalated-symfony](https://github.com/escalated-dev/escalated-symfony) | PHP | Symfony 6.4/7.x | Composer bundle | PHP 8.2+, Node 18+ |
| escalated-go | [escalated-dev/escalated-go](https://github.com/escalated-dev/escalated-go) | Go | net/http, Chi | Go module | Go 1.21+ |
| escalated-wordpress | [escalated-dev/escalated-wordpress](https://github.com/escalated-dev/escalated-wordpress) | PHP | WordPress 6.0+ | WP plugin | PHP 8.1+ |

## UI Packages

| Repo | GitHub | Language | Purpose |
|------|--------|----------|---------|
| escalated-filament | [escalated-dev/escalated-filament](https://github.com/escalated-dev/escalated-filament) | PHP | Filament v3/4/5 admin panel plugin (wraps escalated-laravel) |
| escalated (frontend) | [escalated-dev/escalated](https://github.com/escalated-dev/escalated) | Vue 3 / TypeScript | Shared Inertia.js page components used by all backend packages |

## Plugin Ecosystem

| Repo | GitHub | Language | Purpose |
|------|--------|----------|---------|
| escalated-plugin-sdk | [escalated-dev/escalated-plugin-sdk](https://github.com/escalated-dev/escalated-plugin-sdk) | TypeScript | SDK for building plugins (`definePlugin()`) |
| escalated-plugin-runtime | [escalated-dev/escalated-plugin-runtime](https://github.com/escalated-dev/escalated-plugin-runtime) | TypeScript | Node.js runtime that loads and executes plugins |
| escalated-plugins | [escalated-dev/escalated-plugins](https://github.com/escalated-dev/escalated-plugins) | TypeScript | Monorepo of all official plugins |

## Client Applications

| Repo | GitHub | Language | Purpose |
|------|--------|----------|---------|
| escalated-desktop | [escalated-dev/escalated-desktop](https://github.com/escalated-dev/escalated-desktop) | Rust / Yew (WASM) | Tauri v2 multi-site agent desktop app |
| escalated-flutter | [escalated-dev/escalated-flutter](https://github.com/escalated-dev/escalated-flutter) | Dart | Flutter mobile SDK (customer-facing) |

## Infrastructure

| Repo | GitHub | Purpose |
|------|--------|---------|
| escalated-cloud | [escalated-dev/escalated-cloud](https://github.com/escalated-dev/escalated-cloud) | Cloud API (cloud.escalated.dev) |
| escalated-docs | [escalated-dev/escalated-docs](https://github.com/escalated-dev/escalated-docs) | Public documentation site (multi-language) |
| escalated-developer-context | [escalated-dev/escalated-developer-context](https://github.com/escalated-dev/escalated-developer-context) | This repo -- developer knowledge base |

## Official Plugins (in escalated-plugins monorepo)

Each plugin has two packages: a metadata/README package (`plugin-{name}`) and an SDK implementation (`plugin-{name}-sdk`).

### Integrations

| Plugin | Purpose |
|--------|---------|
| escalated-plugin-slack | Slack notifications and bi-directional messaging |
| escalated-plugin-jira | Jira issue linking and sync |
| escalated-plugin-whatsapp | WhatsApp Business messaging channel |
| escalated-plugin-social | Social media (Twitter/X, Facebook) messaging |

### Channels

| Plugin | Purpose |
|--------|---------|
| escalated-plugin-phone | Phone/voice channel integration |
| escalated-plugin-sms | SMS messaging channel |
| escalated-plugin-livechat | Real-time live chat widget |
| escalated-plugin-web-widget | Embeddable web widget for customer sites |
| escalated-plugin-proactive-messages | Proactive outbound messaging |

### AI and Automation

| Plugin | Purpose |
|--------|---------|
| escalated-plugin-ai-copilot | AI-powered agent assistance and auto-responses |
| escalated-plugin-kb-ai | AI-powered knowledge base search and suggestions |
| escalated-plugin-omnichannel-routing | Advanced multi-channel ticket routing |
| escalated-plugin-unified-status | Unified agent status across channels |

### Workflow

| Plugin | Purpose |
|--------|---------|
| escalated-plugin-approvals | Multi-stage approval workflows |
| escalated-plugin-scheduled-reports | Automated report generation and delivery |
| escalated-plugin-nps | Net Promoter Score surveys |
| escalated-plugin-compliance | Compliance and data retention rules |
| escalated-plugin-ticket-sharing | Cross-instance ticket sharing |
| escalated-plugin-custom-layouts | Customizable ticket form layouts |
| escalated-plugin-custom-objects | Custom data objects and relationships |
| escalated-plugin-ip-restriction | IP-based access restrictions |

### Data Import

| Plugin | Purpose |
|--------|---------|
| escalated-plugin-import-zendesk | Import from Zendesk |
| escalated-plugin-import-freshdesk | Import from Freshdesk |
| escalated-plugin-import-intercom | Import from Intercom |
| escalated-plugin-import-helpscout | Import from Help Scout |

### Platform

| Plugin | Purpose |
|--------|---------|
| escalated-plugin-marketplace | Plugin marketplace UI and distribution |
| escalated-plugin-community | Community forums |
| escalated-plugin-mobile-sdk | Mobile SDK support utilities |

## Key Dependencies (Shared)

| Dependency | Used By | Purpose |
|------------|---------|---------|
| Inertia.js | All backend packages (except WordPress, Go) | Server-driven SPA protocol |
| Vue 3 | Frontend, all Inertia backends | UI framework |
| Tailwind CSS | Frontend, Desktop, WordPress | Utility-first CSS |
| Vite | Frontend, Laravel, AdonisJS | Build tool |

## CI/CD Linting

All repositories enforce code style via GitHub Actions:

| Repo | Linter |
|------|--------|
| escalated (frontend) | ESLint + Prettier |
| escalated-laravel | Laravel Pint |
| escalated-rails | RuboCop |
| escalated-django | Ruff |
| escalated-adonis | ESLint + Prettier |
| escalated-symfony | PHP-CS-Fixer |
| escalated-go | golangci-lint |
| escalated-phoenix | Credo + mix format |
| escalated-filament | Laravel Pint |
| escalated-wordpress | Laravel Pint |
| escalated-plugin-sdk | ESLint + Prettier |
| escalated-plugin-runtime | ESLint + Prettier |
