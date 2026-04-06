# UI-Optional Pattern

How the headless / UI-optional mode works across all Escalated frameworks.

## Concept

Every Escalated backend package can run in two modes:

1. **Full UI** (default) -- Inertia.js routes serve Vue 3 pages for agent, customer, and admin interfaces
2. **Headless** -- Only the backend is active: API routes, commands, events, migrations, and the plugin runtime

This lets teams use Escalated's ticketing backend with their own custom frontend (React, Blade, Livewire, native mobile, etc.) while still getting the full service layer, SLA engine, escalation rules, and plugin system.

## How to Enable Headless Mode

Set `ui_enabled` to `false` in config:

```php
// Laravel: config/escalated.php
'ui' => ['enabled' => false],
```

```python
# Django: settings.py
ESCALATED = { 'UI_ENABLED': False }
```

```ruby
# Rails: config/initializers/escalated.rb
config.ui_enabled = false
```

```typescript
// AdonisJS: config/escalated.ts
ui: { enabled: false },
```

```elixir
# Phoenix: config/config.exs
config :escalated, ui_enabled: false
```

```go
// Go
cfg.UIEnabled = false
```

## What Changes in Headless Mode

| Component | UI Enabled | Headless |
|-----------|-----------|----------|
| Customer portal routes | Active | Not registered |
| Agent dashboard routes | Active | Not registered |
| Admin panel routes | Active | Not registered |
| REST API routes | Active | Active |
| CLI commands | Active | Active |
| Events and listeners | Active | Active |
| Plugin runtime | Active | Active |
| Migrations | Active | Active |
| SLA engine | Active | Active |
| Inertia.js dependency | Required | Not required |
| Vue 3 npm package | Required | Not required |

## The Renderer Abstraction

The UI-optional pattern is implemented through a renderer abstraction. Each framework defines an interface that controllers call instead of rendering directly:

### Laravel

```php
// Interface
interface EscalatedUiRenderer
{
    public function render(string $page, array $props = []): mixed;
}

// Default implementation (Inertia)
class InertiaUiRenderer implements EscalatedUiRenderer
{
    public function render(string $page, array $props = []): mixed
    {
        return Inertia::render($page, $props);
    }
}

// Controller usage
class TicketController
{
    public function show(Ticket $ticket, EscalatedUiRenderer $renderer)
    {
        return $renderer->render('Escalated/Agent/TicketShow', [
            'ticket' => $ticket->toArray(),
        ]);
    }
}
```

### Django

```python
# Function abstraction
def render_page(request, page, props=None):
    """Render an Escalated page. Override for custom rendering."""
    return inertia.render(request, page, props or {})

# View usage
def ticket_show(request, ticket_id):
    ticket = ticket_service.get_ticket(ticket_id)
    return render_page(request, 'Escalated/Agent/TicketShow', {
        'ticket': ticket.to_dict(),
    })
```

### Rails

```ruby
# Module
module Escalated::UiRenderer
  def render_escalated_page(page, props = {})
    render inertia: page, props: props
  end
end

# Controller usage
class Escalated::Agent::TicketsController < ApplicationController
  include Escalated::UiRenderer

  def show
    ticket = Escalated::TicketService.find(params[:id])
    render_escalated_page 'Escalated/Agent/TicketShow', ticket: ticket.as_json
  end
end
```

### Go

```go
// Interface
type Renderer interface {
    Render(w http.ResponseWriter, r *http.Request, page string, props map[string]interface{})
}

// Default implementation
type InertiaRenderer struct{}

func (ir *InertiaRenderer) Render(w http.ResponseWriter, r *http.Request, page string, props map[string]interface{}) {
    inertia.Render(w, r, page, props)
}

// Handler usage
func HandleTicketShow(cfg *Config) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        ticket := cfg.TicketService.Find(ticketID)
        cfg.Renderer.Render(w, r, "Escalated/Agent/TicketShow", map[string]interface{}{
            "ticket": ticket,
        })
    }
}
```

## Custom Renderer Example

A team using Blade templates instead of Inertia:

```php
class BladeUiRenderer implements EscalatedUiRenderer
{
    public function render(string $page, array $props = []): mixed
    {
        // Map Inertia page names to Blade views
        $view = str_replace(['Escalated/', '/'], ['escalated.', '.'], $page);
        $view = Str::snake($view, '-');
        return view($view, $props);
    }
}

// In a service provider
$this->app->bind(EscalatedUiRenderer::class, BladeUiRenderer::class);
```

## Building a Custom Frontend

When running in headless mode, build your frontend against the REST API:

### API Endpoints Available

```
GET    /support/api/v1/tickets          # List tickets (filterable)
POST   /support/api/v1/tickets          # Create ticket
GET    /support/api/v1/tickets/{id}     # Get ticket
PATCH  /support/api/v1/tickets/{id}     # Update ticket
POST   /support/api/v1/tickets/{id}/replies     # Add reply
POST   /support/api/v1/tickets/{id}/assign      # Assign
POST   /support/api/v1/tickets/{id}/status      # Transition status
GET    /support/api/v1/departments      # List departments
GET    /support/api/v1/tags             # List tags
GET    /support/api/v1/sla-policies     # List SLA policies
GET    /support/api/v1/agents           # List agents
GET    /support/api/v1/reports/*        # Reporting endpoints
```

### Authentication

API routes use Bearer token authentication:

```
Authorization: Bearer esc_live_a1b2c3d4e5f6...
```

Tokens are created in the admin panel with scoped abilities.

## When to Use Headless Mode

- Building a custom frontend (React, Angular, Svelte, etc.)
- Integrating Escalated into an existing admin panel (like Filament -- though escalated-filament exists for that)
- Using Escalated purely as a backend API for mobile apps
- Embedding ticket functionality into an existing page layout
- Using server-rendered templates (Blade, ERB, Jinja2) instead of Inertia
