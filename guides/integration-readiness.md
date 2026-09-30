# Merchant integration readiness

Updated 2026-09-30. Status is specific to the implementation named here; a change
in Laravel or Phoenix does not establish parity in the other backends.

## Web-widget plugin

The plugin is an unreleased prototype and is not available for merchant or public
use. Source copies live in `escalated-plugin-web-widget` and
`escalated-plugins/plugins/escalated-plugin-web-widget-sdk`. They use the same npm
package name and must carry the same availability status. Both READMEs list the
release criteria; both package manifests set `private: true` while incomplete.

This does not decommission or certify the separate built-in backend widgets.
It also does not unpublish a registry artifact or modify a deployed marketplace.

## Slack

Laravel implements authenticated, durable inbound text messages in source. The
native receiver verifies the original signed bytes and timestamp before resolving
trusted app/workspace/channel mappings. It commits an encrypted inbox receipt
before acknowledging Slack; scheduled processing creates a ticket from a root
message and public replies from its thread. Retried events are deduplicated, and
concurrent workers are covered by PostgreSQL and MySQL tests.

The host provisions requester identities and tenant mappings. Message text cannot
select a tenant or requester. Bot/subtype messages are ignored. File imports,
edits, deletions, automatic Slack identity discovery and replies to unmapped
pre-existing threads are not implemented. Native tenant-mode outbound Slack
delivery is also not implemented; do not describe this as complete bidirectional
support across backends.

The single-tenant SDK plugin path now verifies Slack signatures and uses the
compatible runtime HTTP bridge. Laravel subscribes to `slack.message.received`,
independently verifies its signed bytes and durably accepts the message. The
plugin returns a retryable error if the host does not acknowledge acceptance.
Generic plugin execution remains disabled in tenant mode; use the native route.

Source availability is not a published package or a deployed Slack app. Release
compatible SDK/runtime/plugin/backend versions, migrate the inbox, configure the
signing secret and trusted mappings, and run the scheduler before activation.
The [Laravel Slack runbook](https://github.com/escalated-dev/escalated-laravel/blob/main/docs/slack-inbound.md)
documents setup, retries, failed receipts, retention and notification limitations.

## Microsoft Teams

**Planned; not implemented. No release date is committed.** The merchant
integration requirement now explicitly includes a Teams adapter. No existing
Teams implementation or documented delivery plan was found in the reviewed
repositories before this roadmap entry.

The intended scope is authenticated inbound messages and ticket/thread replies,
with outbound notifications, tenant routing and durable deduplication. Build it
on the shared inbound-channel contract established for Slack. Provider-specific
authentication and installation must be validated against Microsoft's current
official API before implementation; Slack's signing scheme is not reusable for
Teams.

Activation will require the host's Microsoft application configuration, allowed
tenant/team/channel mappings and requester identity policy. Production values
are configuration inputs, not reasons to claim the adapter is already available.

## Merchant host boundary

Laravel source now includes separate-database identity resolution, tenant query
and policy isolation, tenant-local staff seats (host gates plus resolver
`isAgent`/`isAdmin`, denied by default), private authorized attachment
delivery, verified expiring guest access with tracking-reference lookup, and
atomic agent API creation with requester, metadata and subjects. CI covers Laravel 11/12/13, exact 13.8 and
separate host/package databases. Laravel's Slack inbox and atomic integration
creation contract must not be inferred for another backend from this summary.

Activation requires the host resolver/catalog and staff seats, legacy tenant
assignment, schema and private-file migration, mail and shared cache configuration, and compatible
frontend forms. Follow the Laravel guides for
[tenancy](https://github.com/escalated-dev/escalated-laravel/blob/main/docs/tenancy.md),
[guest access](https://github.com/escalated-dev/escalated-laravel/blob/main/docs/guest-access.md)
and the repository's attachment/API integration documentation. No production
activation is implied by a merged implementation.

Phoenix source also implements separate host/support repositories, tenant-scoped
queries and writes, tenant-local staff seats, private authorized attachments,
verified expiring guest grants, and host-resolved tracking lookup. Its tenant
boundary includes jobs, caches and realtime topics; customer pages and events
exclude internal correspondence. CI runs SQLite, PostgreSQL and MySQL suites,
plus populated legacy upgrades, case-sensitive tenant uniqueness and guarded
rollback checks on each engine.

The implementation is tracked in [Phoenix #133](https://github.com/escalated-dev/escalated-phoenix/pull/133).

Follow the [Phoenix merchant and guest runbook](https://github.com/escalated-dev/escalated-phoenix/blob/master/docs/merchant-and-guest-access.md).
Activation requires the September 30 migrations, a trusted tenant resolver and
membership/reference/user-directory callbacks, explicit legacy-data assignment,
staff provisioning, a stable guest secret and mailbox-code delivery. Configure
the trusted maintenance catalog and merchant public URL for newsletter links.
Use compatible shared frontend guest forms and tenant broadcast prefixes.

Phoenix merchant guest chat uses capability-authenticated HTTP polling. A host
must supply an Echo-to-Phoenix bridge for the shared frontend's optional socket
client; anonymous merchant sockets are denied. Host-global role changes and
generic plugin execution are unavailable in tenant mode. Raw host repository
access and custom callbacks remain the host's authorization responsibility.
The source implementation does not publish a Hex package or activate production.
Other ports remain unverified for this merchant contract. The Slack, Teams and
web-widget plugin limits above remain unchanged.

The host owns merchant identity and membership. Escalated should consume a trusted
tenant resolver rather than assume an `accounts` table or accept a posted tenant
identifier as authorization. Merchant readiness requires query, policy, reporting,
attachment, guest and broadcast isolation together. Existing deployments need an
explicit assignment of legacy data before enabling that boundary.

References to shipments, orders or accounts are host-owned subjects. Resolve them
on the host connection and store scalar links on Escalated's connection. A tracking
number and a claimed email address are lookup inputs, not proof of access.
