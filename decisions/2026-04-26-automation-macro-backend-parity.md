# 2026-04-26 — Automation and Macro backend parity (NestJS, Symfony, Phoenix, Go)

**Status:** Accepted

## Context

[2026-04-24 — Admin vs agent tool split](2026-04-24-admin-agent-tool-split.md) froze the Workflows / Automations / Macros taxonomy and included a **portfolio matrix as of its lock date** showing Automations and/or Macros still missing on NestJS (reference), Symfony, Phoenix, and Go.

That matrix reflected ship state on 2026-04-24. The taxonomy decision is unchanged; only implementation catch-up remained.

## Decision

As of **2026-04-26**, the four hosts above ship the same three-surface backend model as the other plugins:

- **NestJS** — `AutomationService` + admin automation API + scheduler tick; `MacroService` (already present) unchanged in role.
- **Symfony, Phoenix, Go** — time-based automation runner + macro service aligned with the other hosts.

Canonical **current** portfolio wording lives in [domain-model/workflows-automations-macros](../domain-model/workflows-automations-macros.md). The 2026-04-24 ADR file stays append-only (historical matrix preserved there).

## Consequences

- AI agents and humans should read `workflows-automations-macros.md` for “what exists today,” not the frozen matrix in the 2026-04-24 ADR alone.
- New backend gaps, if they reappear, get a dated ADR or an update to the domain-model doc — not silent edits to accepted ADRs.

## See also

- [2026-04-24 — Admin vs agent tool split](2026-04-24-admin-agent-tool-split.md)
- [domain-model/workflows-automations-macros](../domain-model/workflows-automations-macros.md)
