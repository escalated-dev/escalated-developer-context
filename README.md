# Escalated Developer Context

The single source of truth for all Escalated platform knowledge -- architecture, conventions, approaches, and developer guides.

## What is Escalated?

Escalated is a **multi-framework, embeddable support ticket system**. It provides a full helpdesk -- tickets, SLA tracking, escalation rules, agent workflows, customer portals, and a plugin marketplace -- as a drop-in package for Laravel, Django, Rails, AdonisJS, Phoenix, Symfony, Go, and WordPress.

Three hosting modes let teams run fully self-hosted, sync to a central cloud, or proxy everything to the Escalated Cloud API. A shared Vue 3 + Inertia.js frontend keeps the UI consistent across all backend frameworks.

## How to Navigate This Repo

| Path | What It Covers |
|------|----------------|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | System architecture: hosting modes, driver pattern, plugin system, event model |
| [`CONVENTIONS.md`](CONVENTIONS.md) | Code style, naming, database, git, and testing conventions |
| [`SECURITY.md`](SECURITY.md) | OWASP considerations, auth patterns, plugin sandboxing, token management |
| [`TESTING.md`](TESTING.md) | Test pyramid, framework-specific tooling, CI patterns |
| [`repos/`](repos/) | Per-repo deep dives -- directory structure, config, routes, key files |
| [`repos/overview.md`](repos/overview.md) | Complete map of every repo with purpose, language, and links |
| [`guides/`](guides/) | How-to guides for common platform tasks |

## Repo Inventory (Quick Reference)

| Repo | Language | Purpose |
|------|----------|---------|
| `escalated-laravel` | PHP | Laravel package |
| `escalated-django` | Python | Django app |
| `escalated-rails` | Ruby | Rails engine |
| `escalated-adonis` | TypeScript | AdonisJS v6 package |
| `escalated-phoenix` | Elixir | Phoenix package |
| `escalated-symfony` | PHP | Symfony bundle |
| `escalated-go` | Go | Go package (net/http, Chi) |
| `escalated-wordpress` | PHP | WordPress plugin |
| `escalated-filament` | PHP | Filament admin panel plugin (wraps escalated-laravel) |
| `escalated-cloud` | -- | Cloud API (cloud.escalated.dev) |
| `escalated` | Vue 3 / TS | Shared frontend components |
| `escalated-plugin-sdk` | TypeScript | Plugin authoring SDK |
| `escalated-plugin-runtime` | TypeScript | Plugin execution runtime |
| `escalated-plugins` | TypeScript | Official plugin monorepo |
| `escalated-desktop` | Rust / Yew | Tauri v2 desktop agent app |
| `escalated-flutter` | Dart | Flutter mobile SDK |
| `escalated-docs` | Markdown | Public documentation site |

## Who This Is For

- **Core contributors** working across multiple Escalated repos
- **Plugin developers** building on the SDK
- **Framework implementors** adding Escalated support to a new backend
- **AI agents and tools** that need structured context about the platform

## License

MIT
