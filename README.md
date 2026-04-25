# Escalated Developer Context

The single source of truth for all Escalated platform knowledge -- architecture, conventions, approaches, and developer guides.

## What is Escalated?

Escalated is a **multi-framework, embeddable support ticket system**. It provides a full helpdesk -- tickets, SLA tracking, escalation rules, agent workflows, customer portals, and a plugin marketplace -- as a drop-in package for Laravel, Django, Rails, AdonisJS, Phoenix, Symfony, Go, and WordPress.

Three hosting modes let teams run fully self-hosted, sync to a central cloud, or proxy everything to the Escalated Cloud API. A shared Vue 3 + Inertia.js frontend keeps the UI consistent across all backend frameworks.

## How to Navigate This Repo

| Path | What It Covers |
|------|----------------|
| [`glossary.md`](glossary.md) | One-line definitions of Escalated-specific terms. Start here if a term is ambiguous. |
| [`domain-model/`](domain-model/) | Canonical explanations of core concepts (ticketing, workflows, guest policy, email threading). |
| [`decisions/`](decisions/) | ADRs — locked architectural decisions, dated, append-only. |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | System architecture: hosting modes, driver pattern, plugin system, event model |
| [`CONVENTIONS.md`](CONVENTIONS.md) | Code style, naming, database, git, and testing conventions |
| [`SECURITY.md`](SECURITY.md) | OWASP considerations, auth patterns, plugin sandboxing, token management |
| [`TESTING.md`](TESTING.md) | Test pyramid, framework-specific tooling, CI patterns |
| [`repos/`](repos/) | Per-repo deep dives -- directory structure, config, routes, key files |
| [`repos/overview.md`](repos/overview.md) | Complete map of every repo with purpose, language, and links |
| [`guides/`](guides/) | How-to guides for common platform tasks |

## When to read which

- **"What does X mean?"** → [`glossary.md`](glossary.md)
- **"Why is it done this way?"** → [`domain-model/`](domain-model/) for the concept, [`decisions/`](decisions/) for the ADR that locked it
- **"How do I do X?"** → [`guides/`](guides/)
- **"What's in a specific repo?"** → [`repos/`](repos/)
- **"How should I style / structure / test this?"** → [`CONVENTIONS.md`](CONVENTIONS.md), [`TESTING.md`](TESTING.md)

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
