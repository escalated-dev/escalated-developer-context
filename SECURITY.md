# Security

Security patterns and practices across the Escalated platform.

## OWASP Top 10 Considerations

### 1. Broken Access Control

Escalated uses **role-based access control** with three levels:

- **Customer** -- Can only view/reply to their own tickets
- **Agent** -- Can view/manage tickets in their assigned departments
- **Admin** -- Full access to all tickets, settings, and configuration

Authorization is enforced at the service layer, not just the controller/route level. Every service method checks permissions before executing.

Framework-specific implementations:

| Framework | Mechanism |
|-----------|-----------|
| Laravel | Gates (`escalated-admin`, `escalated-agent`) + Policies |
| Django | Permission classes + `@login_required` / custom decorators |
| Rails | `before_action` callbacks + Pundit-style authorization |
| AdonisJS | Middleware + Bouncer |
| Phoenix | Plugs + custom authorization functions |
| Symfony | Voters + `#[IsGranted]` attributes |
| Go | Middleware functions (`AdminCheck`, `AgentCheck`) |
| WordPress | Custom capabilities (`escalated_admin`, `escalated_agent`) + `current_user_can()` |

Guest ticket access uses **unguessable tokens** (UUID v4 or cryptographically random strings). Guest tokens are never exposed in URLs except via email magic links.

### 2. Cryptographic Failures

- API tokens are stored as SHA-256 hashes, never plaintext
- Cloud API keys are stored encrypted or in environment variables
- Webhook secrets use HMAC-SHA256 for signature verification
- Two-factor authentication secrets are encrypted at rest

### 3. Injection

**SQL Injection**: All database queries use parameterized queries / prepared statements via the framework's ORM (Eloquent, Django ORM, ActiveRecord, Lucid, Ecto, Doctrine, database/sql). Raw SQL is avoided; where used, parameters are always bound.

**XSS**: All output is escaped by default in the view layer (Vue 3 auto-escapes, Blade/Jinja2/ERB auto-escape). User-generated HTML (rich text replies) is sanitized through DOMPurify on the frontend and server-side sanitizers before storage.

**Command Injection**: The plugin runtime communicates over stdin/stdout with JSON-RPC. No shell commands are constructed from user input.

### 4. Insecure Design

- Ticket references (`ESC-123`) are sequential but access is gated by authorization, not obscurity
- Rate limiting on login, API endpoints, and guest ticket creation
- Account lockout after repeated failed authentication attempts

### 5. Security Misconfiguration

- Default config is secure (UI enabled, self-hosted mode, no cloud keys needed)
- Admin routes are protected by both authentication and authorization middleware
- Debug mode / verbose errors are disabled in production configs

### 6. Vulnerable Components

- Dependencies are pinned to specific versions in lock files
- Dependabot / Renovate enabled on all repos for automated security updates
- CI runs security audit tools (`composer audit`, `pip audit`, `bundle audit`, `npm audit`)

### 7. Authentication Failures

- Framework-native authentication is used (not custom auth)
- Session-based auth for web routes, Bearer token auth for API routes
- API tokens support scoped abilities (read-only, write, admin)
- Token expiration is configurable
- Two-factor authentication support

### 8. Data Integrity Failures

- Webhook payloads are signed with HMAC-SHA256
- Plugin packages are installed from npm with integrity checks
- Cloud sync uses signed requests

### 9. Logging and Monitoring

- Full activity timeline on every ticket (who did what, when)
- System-wide audit log for admin actions
- Structured logging for plugin operations
- Failed authentication attempts are logged

### 10. Server-Side Request Forgery (SSRF)

- Plugin HTTP client (`ctx.http`) does not restrict outbound URLs by default but logs all requests
- Inbound email webhook endpoints validate sender signatures (Mailgun, Postmark, SES)
- Cloud API calls use a configured allowlist URL

## Input Validation

### Request Validation

Every controller validates input before passing to services:

```php
// Laravel
$validated = $request->validate([
    'subject' => 'required|string|max:255',
    'body' => 'required|string|max:65535',
    'priority' => 'sometimes|in:low,medium,high,urgent',
    'department_id' => 'sometimes|exists:escalated_departments,id',
]);
```

```python
# Django
class TicketCreateSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=255)
    body = serializers.CharField(max_length=65535)
    priority = serializers.ChoiceField(choices=['low', 'medium', 'high', 'urgent'], required=False)
```

```ruby
# Rails
params.require(:ticket).permit(:subject, :body, :priority, :department_id)
validates :subject, presence: true, length: { maximum: 255 }
```

### Validation Rules

- **Subject**: required, string, max 255 characters
- **Body**: required, string, max 65535 characters
- **Priority**: enum validation (`low`, `medium`, `high`, `urgent`)
- **Department/Agent IDs**: existence validation against the database
- **Email**: format validation for contact emails
- **Tags**: array of existing tag IDs
- **File uploads**: type, size, and count validation

## File Upload Security

- **Allowed types**: configurable allowlist (default: images, PDFs, office documents, plain text)
- **Max size**: configurable per-file limit (default: 10MB)
- **Max count**: configurable per-ticket limit
- **Storage**: files stored outside the web root (using framework storage abstractions)
- **Filename sanitization**: original filenames are sanitized; stored with UUID-based names
- **Content-type validation**: MIME type checked against file content, not just the extension
- **Antivirus**: optional integration point for scanning uploads (not built-in)

## Plugin Sandbox Security

Plugins run in a **separate Node.js process** (the plugin runtime), not in the host framework's process space. Security boundaries:

1. **Process isolation**: Plugins cannot access the host framework's memory, filesystem, or database directly
2. **Controlled API surface**: Plugins can only interact with the host through the `PluginContext` (`ctx.*`) API
3. **Capability-based endpoints**: Plugin REST endpoints can require specific capabilities (`manage_settings`, `manage_tickets`)
4. **Data scoping**: `ctx.store` is scoped to the plugin -- plugins cannot read other plugins' data
5. **Rate limiting**: Plugin HTTP calls and data operations are rate-limited
6. **Logging**: All plugin operations are logged for audit

Plugins **can** make outbound HTTP requests via `ctx.http`. This is by design (integrations need to call external APIs). The host logs these requests.

## API Token Management

The REST API uses Bearer token authentication:

```
Authorization: Bearer esc_live_a1b2c3d4e5f6...
```

Token characteristics:
- Generated with cryptographically random bytes (64+ characters)
- Stored as SHA-256 hash in `escalated_api_tokens` table
- Scoped abilities: `tickets:read`, `tickets:write`, `admin:read`, `admin:write`
- Optional expiration date
- Revocable at any time from the admin panel
- Last-used timestamp tracked for auditing
- Rate limited (configurable, default 60 requests/minute)

## Webhook Signature Verification

Outbound webhooks include a signature header for payload verification:

```
X-Escalated-Signature: sha256=a1b2c3d4e5f6...
```

The signature is computed as `HMAC-SHA256(webhook_secret, request_body)`. Recipients should:

1. Read the raw request body
2. Compute `HMAC-SHA256(their_stored_secret, body)`
3. Compare the computed signature with the header value using constant-time comparison
4. Reject if signatures do not match or if the timestamp is too old (replay protection)

Inbound webhooks (Mailgun, Postmark, SES) are verified using each provider's documented signature scheme.

## CSRF Prevention

- All web routes use framework-native CSRF protection (CSRF tokens in forms, `X-CSRF-TOKEN` header for AJAX)
- Inertia.js handles CSRF automatically via cookies
- API routes (Bearer token auth) are exempt from CSRF -- the token itself is the proof of intent
- Webhook endpoints are exempt from CSRF -- verified by signature instead

## XSS Prevention

- Vue 3 auto-escapes all interpolated content (`{{ }}` syntax)
- Rich text (ticket replies) is sanitized with DOMPurify before rendering
- Server-side sanitization before storage as a defense-in-depth measure
- Content-Security-Policy headers recommended in deployment docs
- No `v-html` usage on unsanitized content

## Additional Security Headers

Recommended (documented in deployment guides):

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; ...
Referrer-Policy: strict-origin-when-cross-origin
```

These are the responsibility of the host application's web server, not the Escalated package itself.
