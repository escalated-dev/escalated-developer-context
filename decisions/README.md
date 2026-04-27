# Decisions

Architecture Decision Records (ADRs). One file per locked decision, dated. Append-only.

## Format

Filename: `YYYY-MM-DD-kebab-case-title.md`

Each ADR has:

- **Context** — what problem prompted the decision, what was on the table
- **Decision** — what got chosen, with the locked specifics
- **Consequences** — what this now requires / forbids / implies
- **Alternatives considered** — what was rejected and why
- **Status** — `Accepted` (default), `Superseded by <link>`, or `Deprecated`

## Rules

- **Append-only.** Don't edit historical ADRs after their date. If the decision changes, write a new ADR that supersedes the old one, and add a `Superseded by` link to the top of the old one.
- **Link from elsewhere.** Domain-model docs should reference ADRs for their "why." Plan docs should reference ADRs for the decisions they implement.
- **Date is the lock date**, not a draft date. Don't commit an ADR until the decision is actually locked.

## Index

| Date | Title | Status |
|---|---|---|
| 2026-04-23 | [Public ticket system architecture](2026-04-23-public-ticket-system.md) | Accepted |
| 2026-04-24 | [Admin vs agent tool split (Workflows / Automations / Macros)](2026-04-24-admin-agent-tool-split.md) | Accepted |
| 2026-04-26 | [Automation + Macro backend parity (NestJS, Symfony, Phoenix, Go)](2026-04-26-automation-macro-backend-parity.md) | Accepted |
