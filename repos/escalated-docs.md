# escalated-docs

**Purpose**: Public documentation site at `docs.escalated.dev`

The public-facing documentation for the Escalated platform. Covers installation, configuration, usage, API reference, and plugin development for all supported frameworks.

## Structure

```
sections/                   # English source docs (canonical)
├── getting-started/
├── configuration/
├── api/
├── plugins/
├── guides/
└── ...

# Translated versions
ar/                         # Arabic
de/                         # German
es/                         # Spanish
fr/                         # French
it/                         # Italian
ja/                         # Japanese
ko/                         # Korean
nl/                         # Dutch
pl/                         # Polish
pt-BR/                      # Brazilian Portuguese
ru/                         # Russian
tr/                         # Turkish
zh-CN/                      # Simplified Chinese

docs.json                   # Section/page structure definition
```

## Content Organization

Documentation is organized by:

1. **Framework** -- Each framework has its own getting-started guide
2. **Feature** -- Cross-framework feature documentation
3. **API** -- REST API reference (shared across all frameworks)
4. **Plugins** -- Plugin development guide and SDK reference

## Multi-Language Support

The docs site supports 14 languages. The English `sections/` directory is the canonical source. Translations are maintained in language-specific directories that mirror the `sections/` structure.

## Relationship to Developer Context

This repo (`escalated-developer-context`) is for **internal developer knowledge** -- architecture decisions, conventions, implementation patterns.

The docs repo (`escalated-docs`) is for **public user-facing documentation** -- how to install, configure, and use Escalated.

Both should stay in sync: when a new feature is added, update both the public docs and the developer context.

## Keeping Docs in Sync

When making changes to any Escalated repo:

1. If the change affects public behavior (API, config, features), update `escalated-docs`
2. If the change affects architecture, patterns, or conventions, update `escalated-developer-context`
3. All plugins need READMEs in the plugins monorepo
