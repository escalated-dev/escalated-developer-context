# Ticket access, accounts and routing

These capabilities are opt-in across all eleven backend packages. Existing
installations keep unrestricted staff ticket access until a host enables a
restriction. Run the additive migrations before enabling the options. Backend
configuration names and resolver signatures follow each framework's conventions;
the behavior below is shared.

## Visibility

The default visibility mode is `all`. In `department` mode a non-admin agent can
access only tickets whose department contains that agent. A ticket without a
department is hidden from restricted agents. Being its requester or assignee
does not grant an exception. Administrators retain access within any existing
tenant boundary; this feature never removes tenant isolation.

Apply the restriction before pagination and aggregation. Cover lists, search,
reports, exports, dashboards, bulk mutations, widgets, APIs and ticket children.
Checking the ticket detail page alone is insufficient. Parent authorization must
also run before direct reply, attachment, side-conversation or link access.

The actor is the authenticated user of the current request. A bearer token uses
its owner's identity, including customer API requests made by an agent. Do not
borrow a browser session's administrator privileges. Actor contexts must be
restored after requests and explicit host integration blocks. Background work
without an actor is trusted internal work; use an explicit actor when a job runs
on someone's behalf.

Recheck assignment candidates and notification recipients. Queued delivery and
live-update polling must observe current membership. Restricted agents must not
receive a shared channel containing other departments' tickets. Where a backend
cannot authorize per-recipient delivery, suppress the shared delivery and use
its authorized host hook or polling path. Existing public requester/guest access
continues through its own ownership checks; it grants no internal-note access.

## Accounts

Accounts are disabled by default. Tickets have a nullable indexed identity pair,
`account_type` and `account_id`, independent of requester and subject. A host
resolver associates the ticket with an account using its requester or subject.
Subject association fills an empty identity and does not overwrite an existing
account through a stale ticket instance.

An identity is a complete pair. IDs are opaque strings: case, leading zeros and
trailing spaces are significant. Validate both fields and compare both exactly;
case-sensitive database collation alone does not guarantee this on engines with
padded string comparison. Malformed account conditions fail closed.

Optional agent account restriction uses one resolved account per agent. It
intersects department restriction when both are enabled. A missing account
grants no ticket access. Multi-account agents need department access or a host
extension; the single-account resolver does not imply multi-account support.

## Routing and SLAs

Escalation rules, event-driven workflows and time-based automations can match
ticket type and account identity. These remain separate automation surfaces as
defined in [workflows, automations and macros](workflows-automations-macros.md).

Targeted SLA selection is disabled by default. When enabled, choose an active
matching policy in this order: department and type, department, type, untargeted
default. Break equal-specificity ties by the lowest policy ID. An unmatched
targeted policy is not a default for every ticket.

Select targets when creating or explicitly attaching an SLA. A department move
preserves the existing policy and deadlines. Explicit reselection uses the
ticket's original creation time; it must not restart an elapsed clock. Hosts
that need a different transition policy must implement it explicitly.

## Host integration and verification

The host owns event-driven intake, domain subject models, staff membership
mapping, and account resolution. The package supplies configuration, resolver
hooks, identity storage and enforcement. Default-off options allow hosts to
adopt those capabilities independently.

For each backend, test default behavior and admin access plus the restricted
paths: list, search, report, bulk action, widget, bearer API, child access,
assignment, and notification/live delivery. Include membership revocation and
account/departments intersection. Exercise populated migrations, supported
database engines, custom prefixes and separate connections where supported.
Preserve a failing regression before the fix for exposed visibility paths.

The initial ports are merged in Laravel [#232](https://github.com/escalated-dev/escalated-laravel/pull/232),
Django [#88](https://github.com/escalated-dev/escalated-django/pull/88),
Rails [#98](https://github.com/escalated-dev/escalated-rails/pull/98),
AdonisJS [#163](https://github.com/escalated-dev/escalated-adonis/pull/163),
Phoenix [#141](https://github.com/escalated-dev/escalated-phoenix/pull/141),
Symfony [#96](https://github.com/escalated-dev/escalated-symfony/pull/96),
Go [#125](https://github.com/escalated-dev/escalated-go/pull/125),
WordPress [#92](https://github.com/escalated-dev/escalated-wordpress/pull/92),
NestJS [#138](https://github.com/escalated-dev/escalated-nestjs/pull/138),
.NET [#172](https://github.com/escalated-dev/escalated-dotnet/pull/172), and
Spring [#101](https://github.com/escalated-dev/escalated-spring/pull/101).
Merged source and published package versions are separate milestones.
