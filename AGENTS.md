# AGENTS.md

Guidance for coding agents and tools working in any Escalated repo. Humans are
welcome to read it too — none of it is agent-specific advice so much as the
things that are easy to get wrong here and expensive to get wrong quietly.

This file is the portfolio-wide entry point. A repo may add its own `AGENTS.md`
for anything specific to it; where the two disagree, the repo's own file wins.

## Start here

| Question | Where |
|---|---|
| What does this term mean? | [`glossary.md`](glossary.md) |
| Why is it built this way? | [`domain-model/`](domain-model/), then [`decisions/`](decisions/) |
| How should I name, style, version this? | [`CONVENTIONS.md`](CONVENTIONS.md) |
| How is this tested? | [`TESTING.md`](TESTING.md) |
| What is in repo X? | [`repos/overview.md`](repos/overview.md) |

**If the code disagrees with these docs, the docs are canonical** — fix the code
to match, or write an ADR if the decision is genuinely changing.

## The shape of the platform

Escalated is one product implemented across eleven backends plus a shared
frontend. That shape produces a specific hazard: **a change that is correct in
one repo can be silently wrong in another**, and no single repo's test suite can
see it.

Three concrete instances, all of which have actually happened:

- **Page names.** Backends render Inertia page names as strings; the frontend
  resolves them to components. A name with nothing behind it is not an error —
  it renders a blank panel on a 200 response. Four screens shipped that way. See
  *Page Names* in [`CONVENTIONS.md`](CONVENTIONS.md).
- **Parity.** A feature added to one backend is not a feature. Check
  [`repos/overview.md`](repos/overview.md) and the parity notes before assuming
  a behaviour exists everywhere.
- **The database.** Most suites default to SQLite, which enforces the least of
  any engine — no foreign keys unless asked, no complaint about comparing a
  boolean to an integer, its own answers on identifier case and length. Several
  backends could not create their own schema on the database they document as
  their default, and every test passed. See [`TESTING.md`](TESTING.md).

## Three concepts worth not re-deriving

These produce wrong answers when reasoned out from the code alone. The canonical
explanation is in
[`domain-model/workflows-automations-macros.md`](domain-model/workflows-automations-macros.md):

- **Workflows** — admin, **event-driven** (`ticket.created`, `reply.created`).
  Cannot be time-triggered.
- **Automations** — admin, **time-based**. A scheduled scan matches open tickets
  on how long they have been waiting. Cannot react to events.
- **Macros** — agent, **manual**, one click. No conditions, no triggers.

They are three separate surfaces and none subsumes the others. Locked by ADR
[`2026-04-24-admin-agent-tool-split`](decisions/2026-04-24-admin-agent-tool-split.md).

## Working in a repo

- **Branch, don't push to `main`.** Branch names and commit format are in
  [`CONVENTIONS.md`](CONVENTIONS.md); commits follow Conventional Commits.
- **Run the repo's own suite** before opening a PR, and say in the PR what you
  ran and what it said. "Tests pass" without a number is not a result.
- **Wait for CI, then merge.** Check every workflow, not just one — a repo
  routinely has separate lint, test and database jobs, and one can be red while
  the others are green.
- **Versions use the patch component** for ordinary work: `1.8.0 → 1.8.1`, not
  `1.9.0`. A package that has never been published starts at `0.1.0`. See
  *Versioning and Releases* in [`CONVENTIONS.md`](CONVENTIONS.md).
- **Never co-author commits with a tool.** No agent names in commit subjects or
  bodies.

## Adding a screen

In this order, or it ships blank:

1. Add the component to `escalated` (the frontend package) and release it.
2. Render its name from the backend, spelled exactly as the frontend spells it.
3. The backend's CI asserts the name against the frontend's published
   `pages.json`. If your new name is not in the version it checks against, the
   frontend release has not landed yet — that is the check doing its job.

## When something looks wrong

Prefer finding out over guessing. A surprising amount of what is written down
here was discovered by running a suite against something it had never been run
against, or by comparing two repos that had never been compared. If a claim in
these docs is contradicted by what you observe, say so — an out-of-date doc that
nobody corrects is worse than no doc.
