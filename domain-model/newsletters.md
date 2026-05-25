# Newsletters

The newsletter system is an admin-only broadcast surface that lets a team send Markdown emails to their `escalated_contacts`. It is **opt-in via `enable_newsletters`** and **off by default** in every host backend. When disabled, no routes, services, scheduler hooks, or admin UI register at boot.

> **ADR:** [2026-05-19 — Newsletter system](../decisions/2026-05-19-newsletter-system.md) — why this feature exists, why it lives in-tree (not as a plugin or cloud service), and what's intentionally out of scope.

> **Spec:** [`escalated/docs/superpowers/specs/2026-05-19-newsletter-system-design.md`](https://github.com/escalated-dev/escalated/blob/main/docs/superpowers/specs/2026-05-19-newsletter-system-design.md) — full architectural detail.

---

## Three things easy to confuse

| | Newsletter | NewsletterTemplate | NewsletterList |
|---|---|---|---|
| **What it is** | One campaign send (subject, body, schedule, status) | Reusable Markdown + theme + default subject | Named recipient bucket |
| **Lifecycle** | `draft → scheduled → sending → sent` (or `paused`/`failed`) | Mutable; reused across campaigns | Mutable; mid-send list changes are safe (Plan snapshots recipients) |
| **Owned by** | Admin (`newsletters.manage` / `newsletters.send`) | Admin (`newsletters.manage`) | Admin (`newsletters.manage`) |
| **Stored in** | `escalated_newsletters` | `escalated_newsletter_templates` | `escalated_newsletter_lists` + `escalated_newsletter_list_members` (static) |

A **Newsletter** is the campaign object. Sending it produces N **NewsletterDelivery** rows — one per recipient — which hold the tracking token, open/click/bounce state, and final delivery status.

A **NewsletterList** is either **static** (an explicit set of contact IDs via the `_list_members` pivot) or **dynamic** (a saved filter JSON evaluated against the contacts table at Plan time). The choice is set at list creation and immutable.

A **NewsletterTemplate** is a reusable authoring artifact — body + theme + optional default subject. It is not a campaign; a campaign references it (via `template_id`) and may override the body or theme.

---

## Pipeline

`Submit → Plan → Dispatch → Track.`

1. **Submit.** Admin POSTs to the newsletter CRUD endpoint with `status` in `{draft, scheduled, sending}`. Validation: list exists and is non-empty, body or template ref present, From-email valid, outbound mail configured at the host level (for non-draft saves), `scheduled_at` in the future (for scheduled). No background work.

2. **Plan.** Triggered by the scheduler tick when `status = scheduled AND scheduled_at <= now`, or by an explicit Send-Now admin action. The planner:
   - Flips newsletter status to `sending`.
   - Resolves the target list to a set of contact IDs (static = pivot query; dynamic = filter evaluation).
   - Filters out contacts with `marketing_opt_out_at IS NOT NULL`.
   - Filters out contacts whose email is in the hard-bounce suppression set.
   - Generates one `NewsletterDelivery` row per surviving recipient with a fresh 40-char `tracking_token` and `email_at_send` snapshotted from the contact (so mutation after Plan is safe).
   - Writes `summary_total` on the newsletter.

3. **Dispatch.** A cron tick (default every minute) pulls `status = pending` delivery rows in batches (default 50). For each row: claim under a transaction (`status = queued, claimed_at = now`), render via the renderer service, send via the host's mail adapter, mark `status = sent` on success. Synchronous failures retry with exponential backoff (1m, 5m, 30m) up to 3 attempts before terminal `failed`. Rows stuck in `queued` for >10 minutes are reclaimed to `pending` (worker-crash recovery). When all deliveries are terminal, the newsletter flips to `sent`.

4. **Track.** Two ingress paths, idempotent updates:
   - **ESP webhooks** at `/escalated/webhooks/newsletter/{postmark|mailgun|ses|sendgrid}`. Events keyed by `Message-ID` → `tracking_token`. Handles `delivered`, `opened`, `clicked`, `bounced` (soft = log only; hard = mark `bounced` + suppress email + increment `summary_bounced`), `complained` (mark + suppress).
   - **Self-hosted pixel + redirect**: `/escalated/n/o/{token}.gif` (open) and `/escalated/n/c/{token}?u=<base64-url>` (click). The renderer rewrites every `<a href>` in the outbound HTML to the click endpoint and appends the pixel before `</body>`.

   Both paths use **first-event-wins** for `opened_at` and **last-event-wins** for `last_clicked_at`. Opens after a bounce are dropped. The two paths are not mutually exclusive — ESP and self-hosted can both fire, and the idempotency guards ensure correctness.

---

## One-click unsubscribe (RFC 8058)

Outbound emails carry these headers:

```
List-Unsubscribe: <https://host/escalated/n/u/{token}>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
X-Escalated-Newsletter-Id: <newsletter_id>
Message-ID: <n-{newsletter_id}-{token}@host>
```

When Gmail/Yahoo bulk-sender rules fire the one-click POST, `/escalated/n/u/{token}` sets `contacts.marketing_opt_out_at = now()`. The flag is **contact-scoped** (not delivery-scoped, not list-scoped): once set, every future campaign skips this contact regardless of which list they're in.

Re-opt-in requires admin action — there is no customer-facing preference center in v1. A future v1.1+ scope item.

---

## Rendering

Two-stage pipeline:

**Stage 1: Markdown → canonical HTML.** Each backend uses its language's standard Markdown library (`league/commonmark` Laravel, `markdown-it` NestJS, `Earmark` or host-supplied Phoenix, `markdown` Django, `flexmark`/`commonmark-java` Spring, `goldmark` Go, `Markdig` .NET, etc.). The renderer is configurable: hosts pass a Markdown converter callable.

Merge fields use `{{ contact.field }}` syntax. Resolution happens **after** Markdown→HTML, against a strict allowlist:

- `contact.name`, `contact.first_name`, `contact.email`
- `contact.metadata.<key>` (dotted-path into the contact's JSON metadata)
- `unsubscribe_url`, `view_in_browser_url`, `tracking_pixel` (auto-injected)

Unknown fields render as empty strings (never as raw `{{ }}` text). The renderer never invokes the host template language on user content — themes alone get the host template engine. This prevents SSTI.

**Stage 2: Themed wrapping.** A *theme* is a server-side template file in the host's templating language (Blade `.blade.php`, Handlebars `.hbs`, ERB `.html.erb`, Django `.html`, Twig `.html.twig`, Edge `.edge`, EEx `.html.eex`, Go `html/template`, Razor or plain HTML for .NET/Spring/WP). Each theme receives `subject`, `body` (pre-rendered HTML), `unsubscribe_url`, `view_in_browser_url`, `brand.*`.

Each backend ships two starter themes: **`default`** (clean single-column, accessible AA contrast) and **`branded`** (header logo + accent color). Customers add themes by dropping files into the conventional theme directory; the renderer scans at request time.

**Stage 3 (optional): Click rewrite + pixel injection.** Skipped when `newsletter.tracking_enabled = false`. Otherwise post-render: walk anchors, rewrite all `<a href>` except `mailto:`/`tel:`/the unsubscribe and view-in-browser links, base64-url-encode the original URL into the click endpoint. Append a 1×1 pixel to the body close. The walk uses each host's DOM library or a regex (no DOM dep mandated).

---

## Feature gating (the "zero code runs when disabled" promise)

Three layers, all required:

1. **Module/provider registration.** Each backend's bootstrap reads `enable_newsletters` and conditionally registers the newsletter module/services/routes. When false: no controllers register, no entities mount, no scheduler hooks subscribe. Schema migrations still run (so re-enabling is a no-op migration), but no code executes.

2. **Frontend nav.** The shared Vue/Inertia frontend reads `escalated.features.newsletters` from page props. Sidebar entry is **omitted** (not just hidden) when false; admin routes resolve to 404 from the backend.

3. **Settings-level sub-toggles.** Stored in `escalated_settings`, read only when the top-level flag is on:
   - `newsletter.default_from`, `newsletter.default_reply_to`, `newsletter.default_theme`
   - `newsletter.rate_limit_per_minute`, `newsletter.batch_size`
   - `newsletter.tracking_enabled` (privacy escape hatch — disables pixel + click rewriting but keeps ESP bounce webhooks)

**Disable-after-enable behavior:** in-flight `sending` newsletters halt at the next dispatcher tick (no new dispatches); existing `queued` rows are reclaimed to `pending` but don't dispatch. Tracking endpoints return 404. Admin UI vanishes. **Data is preserved** — flipping the flag is never destructive.

---

## Permissions

Two new slugs, both seeded onto the Admin role:

- **`newsletters.manage`** — CRUD on lists, templates, draft newsletters; Send Test to Me
- **`newsletters.send`** — Schedule, Send Now (dispatch authority)

Split so a future non-admin Marketing role can be granted `newsletters.manage` without `newsletters.send`, or vice versa, without code changes.

---

## Wire contract

All payloads use `snake_case` over the wire (matches Inertia convention; NestJS DTOs convert internally to `camelCase`).

### Admin routes (gated on the admin guard + `newsletters.manage`)

```
GET    /admin/newsletters                       Index (drafts/scheduled/sent tabs)
GET    /admin/newsletters/new                   Compose
POST   /admin/newsletters                       Create
POST   /admin/newsletters/preview               Live preview (JSON: { html })
POST   /admin/newsletters/test                  Send Test to Me
GET    /admin/newsletters/{id}                  Detail (overview / deliveries / analytics tabs)
GET    /admin/newsletters/{id}/edit             Edit draft
PUT    /admin/newsletters/{id}                  Update
DELETE /admin/newsletters/{id}                  Delete (drafts only)

GET    /admin/newsletters/lists                 Lists index
GET    /admin/newsletters/lists/new             Create list
POST   /admin/newsletters/lists                 Store
GET    /admin/newsletters/lists/{id}            Detail
PUT    /admin/newsletters/lists/{id}            Update
DELETE /admin/newsletters/lists/{id}            Destroy
POST   /admin/newsletters/lists/{id}/members    Add member (static)
DELETE /admin/newsletters/lists/{id}/members/{contactId}
POST   /admin/newsletters/lists/{id}/import     CSV import

GET    /admin/newsletters/templates             Templates index
GET    /admin/newsletters/templates/new         Create
POST   /admin/newsletters/templates             Store
GET    /admin/newsletters/templates/{id}        Show / edit
PUT    /admin/newsletters/templates/{id}        Update
DELETE /admin/newsletters/templates/{id}        Destroy

GET    /admin/newsletters/settings              Newsletter settings page
PUT    /admin/newsletters/settings              Update settings
```

### Public routes (no auth; token-gated)

```
GET    /escalated/n/o/{token}.gif    1×1 PNG; records open
GET    /escalated/n/c/{token}?u=<b64>  Records click; 302 to decoded URL
GET    /escalated/n/u/{token}        Confirmation page
POST   /escalated/n/u/{token}        One-click unsub (RFC 8058 compatible)
GET    /escalated/n/v/{token}        View-in-browser themed render
```

### ESP webhook routes (no auth; provider signature validation)

```
POST   /escalated/webhooks/newsletter/postmark
POST   /escalated/webhooks/newsletter/mailgun
POST   /escalated/webhooks/newsletter/ses
POST   /escalated/webhooks/newsletter/sendgrid
```

---

## Three concepts most prone to re-derivation

When working in this area, these are the bits that get re-invented (wrongly) if you only read the code:

1. **`marketing_opt_out_at` is contact-scoped, not list-scoped.** Setting it removes the contact from *every* newsletter, on *every* list, forever (until admin action). Don't add a per-list unsubscribe flag.
2. **Tracking is a two-path ingress.** Both ESP webhooks and self-hosted pixel/redirect endpoints feed the same `NewsletterDelivery` row. They don't compete — they're idempotent and first/last-event-wins. Don't disable one when the other is configured.
3. **Plan freezes recipients.** Mid-send list mutations are safe by design. Adding contacts to a list that's mid-send does *not* extend the send; removing them does *not* cancel queued deliveries. The snapshot is the source of truth from Plan onward.

---

## Out of scope (flagged for v1.1+)

- A/B subject testing
- Drip / sequence campaigns
- Customer-facing preference center
- Cold-list / standalone-subscriber imports
- Drag-and-drop visual builder
- Engagement-based dynamic segments (e.g. "opened last 3 newsletters")
- Multi-language template variants
- API-driven external sends
- Marketing-role permission preset
