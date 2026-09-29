# Merchant integration readiness

Updated 2026-09-29. Status is specific to the implementation named here; a change
in Laravel does not establish parity in the other backends.

## Web-widget plugin

The plugin is an unreleased prototype and is not available for merchant or public
use. Source copies live in `escalated-plugin-web-widget` and
`escalated-plugins/plugins/escalated-plugin-web-widget-sdk`. They use the same npm
package name and must carry the same availability status. Both READMEs list the
release criteria; both package manifests set `private: true` while incomplete.

This does not decommission or certify the separate built-in backend widgets.
It also does not unpublish a registry artifact or modify a deployed marketplace.

## Slack

Outbound notification code exists. Inbound ticket delivery remains in progress.
An emitted `slack.message.received` hook alone is not an inbound integration.
Before advertising bidirectional support, acceptance coverage must demonstrate:

- Signature verification over the original request bytes, timestamp freshness,
  and real HTTP rejection before processing challenges or messages.
- Trusted workspace/channel-to-tenant routing and requester identity mapping.
- Durable event deduplication, a root message creating one ticket, and a thread
  reply reaching the same ticket despite retries.
- Suppression of bot echoes and protection of internal notes.
- SDK, runtime and backend bridge interoperability using a real plugin manifest.

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

The host owns merchant identity and membership. Escalated should consume a trusted
tenant resolver rather than assume an `accounts` table or accept a posted tenant
identifier as authorization. Merchant readiness requires query, policy, reporting,
attachment, guest and broadcast isolation together. Existing deployments need an
explicit assignment of legacy data before enabling that boundary.

References to shipments, orders or accounts are host-owned subjects. Resolve them
on the host connection and store scalar links on Escalated's connection. A tracking
number and a claimed email address are lookup inputs, not proof of access.
