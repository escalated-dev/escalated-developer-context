# escalated-plugins

**Language**: TypeScript | **Structure**: npm workspaces monorepo

Monorepo containing all official Escalated plugins. Each plugin is a pair of packages: a metadata/README package and an SDK implementation package.

## Structure

```
plugins/
├── escalated-plugin-slack/            # Metadata, README
├── escalated-plugin-slack-sdk/        # SDK implementation (definePlugin)
├── escalated-plugin-jira/
├── escalated-plugin-jira-sdk/
├── escalated-plugin-ai-copilot/
├── escalated-plugin-ai-copilot-sdk/
├── escalated-plugin-whatsapp/
├── escalated-plugin-whatsapp-sdk/
├── ... (30+ plugin pairs)
```

## Package Naming Convention

- `@escalated-dev/plugin-{name}` -- Metadata package (README, category info)
- `@escalated-dev/plugin-{name}-sdk` -- SDK implementation (the actual plugin code)

The `-sdk` package contains the `definePlugin()` call and is what the plugin runtime loads and executes.

## Plugin Categories

### Integrations
- **Slack** -- Notifications, bi-directional messaging, channel mapping
- **Jira** -- Issue linking, status sync, two-way updates
- **WhatsApp** -- WhatsApp Business messaging channel
- **Social** -- Twitter/X and Facebook messaging

### Channels
- **Phone** -- Voice/phone channel
- **SMS** -- SMS messaging
- **Live Chat** -- Real-time chat widget
- **Web Widget** -- Embeddable support widget
- **Proactive Messages** -- Outbound messaging triggers

### AI and Automation
- **AI Copilot** -- AI-powered agent assist, auto-draft replies, summarization
- **KB AI** -- AI-powered knowledge base search and auto-suggestions
- **Omnichannel Routing** -- Advanced routing across channels
- **Unified Status** -- Cross-channel agent presence

### Workflow
- **Approvals** -- Multi-stage approval workflows
- **Scheduled Reports** -- Automated report generation
- **NPS** -- Net Promoter Score surveys
- **Compliance** -- Data retention and compliance rules
- **Ticket Sharing** -- Cross-instance ticket sharing
- **Custom Layouts** -- Customizable ticket form layouts
- **Custom Objects** -- Custom data schemas
- **IP Restriction** -- IP-based access control

### Data Import
- **Import Zendesk** -- Migrate from Zendesk
- **Import Freshdesk** -- Migrate from Freshdesk
- **Import Intercom** -- Migrate from Intercom
- **Import Help Scout** -- Migrate from Help Scout

### Platform
- **Marketplace** -- Plugin marketplace UI
- **Community** -- Community forums
- **Mobile SDK** -- Mobile SDK utilities

## Developing a Plugin

1. Create two directories: `plugin-{name}/` and `plugin-{name}-sdk/`
2. The `-sdk` package depends on `@escalated-dev/plugin-sdk`
3. Export a `definePlugin()` call as the default export
4. The metadata package contains README and category info
5. Publish both packages to npm under `@escalated-dev`

See the [Plugin Development Guide](../guides/plugin-development.md) for the full workflow.

## Running Tests

```bash
# From monorepo root
npm test

# Specific plugin
cd plugins/escalated-plugin-slack-sdk && npm test
```

Uses Vitest for all plugin tests.
