# plugins-marketplace

The plugin marketplace (`marketplace.escalated.dev`) is the discovery and distribution channel for Escalated plugins.

## Availability

An entry in the repository catalogue is not a release guarantee. The web-widget
plugin is **unreleased and unavailable for merchant use**: its embed bundle and
configurator are missing, and its declared Origin allowlist is not enforced.
Do not offer installation instructions or an available status for this prototype.
The built-in widget in individual backends is a separate feature.

These source metadata and documentation changes do not update a deployed
marketplace database. A deployment must keep its listing consistent with this
status. See [integration readiness](../guides/integration-readiness.md).

## What It Does

1. **Plugin registry** -- Lists all available plugins with metadata, screenshots, and version history
2. **Discovery** -- Search, filter by category, sort by popularity/rating
3. **Installation** -- Plugins are npm packages; marketplace provides install instructions
4. **Version management** -- Semver with framework compatibility constraints
5. **Categories** -- Integrations, Channels, Automation, Analytics, Import, Utilities

## How Installation Works

Plugins are npm packages published under the `@escalated-dev` scope:

```bash
npm install @escalated-dev/plugin-slack
```

After installing the npm package, the plugin is discovered automatically by the plugin runtime (it scans `node_modules/@escalated-dev/plugin-*`). The admin activates it in the Escalated admin panel, which:

1. Creates a record in the `escalated_plugins` table
2. Calls the plugin's `onActivate` hook
3. Renders any config fields defined in the plugin's `config` schema
4. Registers any pages, components, or widgets

## Plugin Metadata

Each plugin package includes:

- `package.json` -- Standard npm metadata + Escalated-specific fields
- `README.md` -- Description, features, configuration guide
- Plugin definition via `definePlugin()` from the SDK

## The Marketplace Plugin

The marketplace itself is implemented as a plugin (`escalated-plugin-marketplace`). It adds:

- An admin page listing available plugins
- Install/uninstall UI
- Plugin configuration forms
- Version update notifications

This means the marketplace UI is available in every Escalated instance that has the marketplace plugin installed.
