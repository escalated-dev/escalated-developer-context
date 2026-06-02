# 2026-05-19 — Newsletter system

**Status:** Accepted (Laravel reference shipped; 11 backend ports pending merge)

## Context

Escalated's growth roadmap calls for moving the product from "customer support / ticketing" toward "complete customer-care platform." Customers asked repeatedly for the ability to broadcast Markdown emails to their existing contacts without having to bolt on a separate service (Mailchimp, ConvertKit, Customer.io). The contact graph already exists in `escalated_contacts`; the outbound mail transport already exists; the admin UI conventions already exist. What was missing was a broadcast surface.

The design needed to satisfy three competing constraints:

1. **Opt-in and removable.** A self-hosted helpdesk that ships a marketing feature must not impose runtime cost on customers who never enable it. "Disabled by default" had to mean "literally zero code executes" — not "no-op'd at the controller layer."
2. **Cross-framework portability.** Escalated ships in 11 backends. Any design that worked only in Laravel/PHP would split the portfolio. The contract had to be language-agnostic at the data and service-boundary level.
3. **Gmail/Yahoo deliverability rules (2024+).** Bulk senders need one-click `List-Unsubscribe` (RFC 8058), contact-scoped opt-out persistence, low spam-complaint rates, and bounce/complaint webhook handling. We can't ship a broadcast tool that immediately gets customers' domains penalized.

## Decision

Ship an admin-only newsletter feature with the following locked contract:

### Four-noun domain model

- **NewsletterList** — named recipient bucket. `kind` ∈ `{static, dynamic}`. Static lists carry explicit `NewsletterListMember` pivot rows; dynamic lists carry a saved-filter JSON evaluated at Plan time.
- **NewsletterTemplate** — reusable Markdown body + theme slug + merge-field schema. Templates are not campaigns; they're authoring snippets.
- **Newsletter** — one campaign send. Subject, from, target list, scheduled-at, status (`draft|scheduled|sending|sent|paused|failed`), summary counts.
- **NewsletterDelivery** — one row per recipient per campaign. Snapshots the email at Plan time (so contact email mutation after planning is safe), holds the tracking token, accumulates open/click/bounce state.

Plus one altered column: `escalated_contacts.marketing_opt_out_at` (nullable timestamp; non-null suppresses the contact from every newsletter regardless of list).

### Four-stage pipeline

**Submit → Plan → Dispatch → Track.**

- **Submit** is the admin saving a draft or scheduling a send. No background work.
- **Plan** flips the newsletter to `sending`, resolves the target list to contact IDs, applies opt-out and hard-bounce suppression filters, then inserts one `NewsletterDelivery` row per surviving recipient with a fresh 40-char tracking token. The snapshot makes mid-send list mutations safe.
- **Dispatch** is a cron-tick batch worker. Pulls `pending` rows, claims them (`status=queued, claimed_at=now`) under a transaction, renders each through the renderer service, sends via the host's existing mail adapter, marks `sent` on success. Retries on synchronous failure with exponential backoff, up to 3 attempts before terminal `failed`. Rate-limited per batch.
- **Track** has two ingress paths: ESP webhooks (Postmark/Mailgun/SES/SendGrid handlers correlate events by `Message-ID`) and self-hosted endpoints (1×1 pixel for opens, base64-redirect for clicks). Both feed the same idempotent delivery row updates.

### Three layers of feature gating

The "zero code runs when disabled" promise requires gating in three places:

1. **Module/provider registration.** Each backend's bootstrap (NestJS `forRoot`, Laravel `ServiceProvider`, Rails Engine, Django app config, etc.) reads `enable_newsletters` and conditionally registers the newsletter module/services/routes. False → none of it loads.
2. **Frontend nav.** The shared Vue/Inertia frontend reads `escalated.features.newsletters` from page props and only renders the Newsletters sidebar entry when true.
3. **Settings-level sub-toggles.** A small set of `escalated_settings` keys (`newsletter.default_from`, `newsletter.tracking_enabled`, etc.) are only consulted when the top-level flag is on.

Schema is created unconditionally at migrate time so re-enabling later is a no-op migration. Data is preserved across disable/re-enable cycles.

### Markdown rendering is host-pluggable

The renderer is the only piece where each backend has substantive logic. Markdown→HTML uses the host language's standard library (`league/commonmark` for Laravel, `markdown-it` for NestJS, `Earmark`/host-supplied for Phoenix, etc.). Merge fields resolve via a strict allowlist (`contact.name`, `contact.first_name`, `contact.email`, `contact.metadata.*`, `unsubscribe_url`, `view_in_browser_url`) after Markdown conversion — never as host template syntax — to prevent SSTI. Click rewriting and pixel injection happen post-render via regex or DOM walk (no DOM dep is mandated).

Themes are server-side template files (Blade in Laravel, Handlebars in NestJS, ERB in Rails, Jinja/Django templates in Django, Twig in Symfony, etc.) discovered at boot from a known directory. Two starter themes ship in every backend: `default` and `branded`.

### Permissions: two new slugs

`newsletters.manage` (authoring) and `newsletters.send` (dispatch authority) are seeded onto the Admin role by default. Split so a non-admin Marketing role can be granted send-without-author later without code changes.

### Out of scope for v1

- A/B subject testing
- Drip / sequence campaigns
- Customer-facing preference center (one-click unsubscribe is sufficient)
- Cold-list / non-contact imports (standalone "subscribers" table)
- Drag-and-drop visual builder
- Engagement-based dynamic segments (needs tracking history)
- Multi-language template variants
- API-driven external sends (admin UI is the only surface)
- Marketing-role permission preset

### Rollout: Laravel reference, then NestJS, then 8 in parallel

Wave 0 (frontend), Wave 1 (Laravel — full controllers + install command + permission seeding), Wave 2 (NestJS port, becomes canonical reference for Wave 3), Wave 3 (Filament + 8 backend ports). Filament wraps Laravel via Filament Resources; the 8 other backends ship as engine-port partials (entities + services + renderer + themes + READMEs) with controllers + scheduler hooks + ESP webhook routes deferred to follow-ups.

## Why not a separate broadcast service / why not a plugin

**Hosted cloud broadcast service** was rejected because Escalated's self-hosted-first model means customers expect the feature to live in their stack with their existing mail config. A cloud dependency would split the product into two operational shapes.

**External plugin via the existing plugin SDK** was rejected because the plugin SDK doesn't currently support DB migrations, scheduled jobs, or admin UI surface registration uniformly across backends. Bootstrapping those capabilities into the SDK would have blocked the newsletter feature for months. The newsletter system is too central to be a plugin in the same sense that "Workflows" or "Automations" aren't plugins.

## Naming

"Newsletter" was chosen over "Broadcast," "Campaign," or "Email" because:

- **Broadcast** implied real-time / high-frequency notification, not the scheduled marketing-style sends customers asked for.
- **Campaign** implied A/B testing, cohort analysis, and lifecycle automation that v1 explicitly omits. Customers asking for "newsletters" know what they're getting.
- **Email** is too generic and would collide with the existing transactional `EmailService`.

If we add drip sequences in v1.1+, those will be called "sequences" — not retroactively rebranded.

## Spec

Authoritative spec lives in the frontend repo:
[`escalated/docs/superpowers/specs/2026-05-19-newsletter-system-design.md`](https://github.com/escalated-dev/escalated/blob/main/docs/superpowers/specs/2026-05-19-newsletter-system-design.md).

## Related PRs

| # | Repo | Scope |
|---|------|-------|
| #75 | escalated | Frontend (Wave 0) — full |
| #103 | escalated-laravel | Laravel reference (Wave 1) — full |
| #51 | escalated-nestjs | NestJS engine port |
| #30 | escalated-filament | Filament Resources |
| #58 | escalated-rails | Rails engine port |
| #74 | escalated-adonis | Adonis engine port |
| #53 | escalated-django | Django engine port |
| #59 | escalated-symfony | Symfony engine port |
| #63 | escalated-go | Go engine + renderer (partial) |
| #67 | escalated-phoenix | Phoenix engine + renderer (partial) |
| #69 | escalated-dotnet | .NET engine + renderer (partial) |
| #63 | escalated-spring | Spring engine + renderer (partial) |
| #57 | escalated-wordpress | WordPress engine + renderer (partial) |

All 13 PRs are CI-green and open for review. Controllers + scheduler hooks + ESP webhook routes are follow-ups for the 9 partial-port backends.
