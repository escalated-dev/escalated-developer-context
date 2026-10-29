# 2026-10-29: Roles & permissions, SSO and two-factor are per-install switches that are either enforced or hidden

## Status

Accepted.

## Context

escalated-laravel ships admin screens for roles and permissions
(`Admin/Roles/*`), SSO (`Admin/Settings/SsoSettings`) and two-factor
authentication (`Admin/Settings/TwoFactor`), and stores what they save. Nothing
enforced any of it:

- Roles and permissions were stored and shared to the frontend as
  `escalated.permissions`, but no admin or agent route checked them. The only
  check was the newsletter screens' `newsletters.manage` / `newsletters.send`.
  An agent with the read-only "Light Agent" role could still assign, close and
  delete tickets.
- SSO settings were saved, and `SsoService` could parse a SAML response or a
  JWT, but no route signed anyone in through them. The SAML code verified at
  most one signature, and checked no Audience, Destination, InResponseTo or
  replay. escalated-adonis #197 and #199 fixed the same gaps in that port.
- Users could enrol in TOTP, but no login ever asked for the code. The shared
  `Auth/TwoFactorChallenge` page existed and no backend rendered it.

A screen that saves security settings nobody enforces is worse than no
screen: admins believe they have restricted access when they have not.
Escalated is also embedded in host applications that often have their own
authorization, SSO and 2FA (Spatie permissions, Socialite, Fortify), so
turning all of this on for everyone is not right either.

## Decision

Each of the three features gets an install-level switch. When a switch is on,
the feature is enforced for real. When it is off, its screens and routes are
gone and nothing in the UI claims it works. Laravel is the reference; the
other ports follow this ADR.

### The switches

| Feature | Laravel config key | Env var | Default |
|---|---|---|---|
| Roles & permissions | `escalated.access.roles_permissions` | `ESCALATED_ROLES_PERMISSIONS` | `false` |
| Two-factor authentication | `escalated.access.two_factor` | `ESCALATED_TWO_FACTOR` | `false` |
| Single sign-on | `escalated.access.sso` | `ESCALATED_SSO` | `false` |

Ports use the same names in their own config idiom (`ESCALATED_*` env vars,
`access.roles_permissions` etc.).

- **Install-level only, not runtime-overridable.** The switches are read from
  configuration, never from the settings table, and no admin screen changes
  them. Each one changes how people sign in or what they may do, and some need
  keys, certificates, a migration or role assignments first. A setting stored
  in the database the feature protects could be turned off by anyone who can
  write that setting, and turning one on from a screen could lock out the
  person doing it.
- **Default off.** None of the three was ever enforced, so off is exactly how
  every existing install behaves today. Turning one on is a deliberate upgrade
  step, described below.
- Settings inside a feature stay runtime-editable where they already are
  (the SSO provider and its fields, and the new "require two-factor"
  setting). They only take effect while the feature's switch is on.

### When a switch is off

- The feature's admin routes and any sign-in routes answer **404**, the same
  way disabled guest, widget and chat routes do (Laravel `EnsureFeatureEnabled`).
  That covers: roles CRUD (`escalated.admin.roles.*`); SSO settings
  (`escalated.admin.settings.sso*`) and every `escalated.sso.*` route; the
  two-factor page and its setup/confirm/disable posts
  (`escalated.admin.two-factor.*`) and the challenge
  (`escalated.two-factor.challenge`, `escalated.two-factor.verify`).
- Shared props say the feature is off (below), and the shared frontend hides
  the navigation entry. Data already stored (roles, enrolments, SSO settings)
  is kept and untouched, so turning the switch on later picks it up.
- Roles & permissions off: the host's `escalated-admin` / `escalated-agent`
  gates are the only authority, as before. This includes the newsletter
  screens, which used to check `newsletters.manage` / `newsletters.send` on
  their own; with the switch off, any admin may use them. (Upgrade note below.)

### Roles & permissions: what "enforced" means

The permission set is the one Laravel already models and seeds
(`PermissionSeeder`): `ticket.*`, `reply.*`, `kb.*`, `department.*`,
`report.*`, `sla.*`, `automation.*`, `escalation.*`, `macro.*`, `tag.*`,
`custom_field.*`, `role.*`, `user.*`, `settings.*`, `webhook.*`,
`api_token.*`, `audit.view`, `plugin.*`, `custom_object.*`, `newsletters.*`.
The seeded system roles are `admin` (every permission), `agent` and
`light_agent`. No new slugs are introduced; every screen maps onto these.

1. A user's permissions are the union of their roles' permissions (`role_user`
   and `role_permission`). Nothing else grants a permission: not the admin
   gate, not `is_admin`. A user who should have everything holds the `admin`
   role.
2. The host gates still decide who reaches the admin and agent areas at all.
   With the switch on, every admin, agent and staff API route **also** requires
   its permission. Both must pass. Failing the permission answers **403**.
3. Every admin, agent and staff API route has an entry in one route-permission
   map (route name to one or more required slugs). A route that is not in the
   map is refused (fail closed), and a test asserts that every registered
   `escalated.admin.*`, `escalated.agent.*` and `escalated.api.*` route
   (mobile customer API excepted) is mapped, so a new route cannot ship
   unguarded. Reads map to `*.view`, writes to `*.manage` (or the finer
   `create`/`edit`/`delete`/`publish` slugs where they exist). Laravel's map
   is `src/Support/RoutePermissions.php`; ports copy it.
4. Actions decided by the request body are checked per action, not per route:
   - a status change needs `ticket.edit`, and also `ticket.close` when the new
     status is `resolved`, `closed` or `reopened`;
   - bulk actions check the permission of each requested action (`assign`
     needs `ticket.assign`, `status` as above, `delete` needs `ticket.delete`,
     `priority`/`tags`/`department` need `ticket.edit`);
   - applying a macro needs `macro.view` and `ticket.edit`.
5. API tokens act as the user who owns them, so the staff API checks that
   user's permissions in addition to the token's abilities.
6. Personal screens every staff member uses for their own account (two-factor
   enrolment) need no permission.
7. Users with no role at all have no permissions. Turning the switch on
   without assigning roles locks staff out of everything but personal screens.
   Laravel provides `php artisan escalated:roles:assign {user} {role}` to
   bootstrap the first admin.

### Two-factor: what "enforced" means

1. **Library.** TOTP is RFC 6238 (SHA-1, 6 digits, 30 s) via a maintained
   library (Laravel: `pragmarx/google2fa`), accepting one step of drift either
   side. A code's time step is recorded on success and that step or any
   earlier one is refused afterwards (no replay within the window).
2. **Enrolment** (`Admin/Settings/TwoFactor`, open to every staff user, not
   only admins): `setup` creates a pending secret and flashes
   `two_factor_setup: {qr_uri, recovery_codes}`; `confirm` takes a 6-digit
   `code`, confirms the enrolment and flashes
   `two_factor_confirmed: {recovery_codes}`; `disable` removes it. Secrets and
   recovery codes are stored encrypted and never sent in props.
3. **Challenge after password login.** When a staff user with a confirmed
   enrolment opens any admin or agent route (Laravel: the `RequireTwoFactor`
   middleware), and this session has not passed the challenge for that user,
   they are redirected to `GET {prefix}/two-factor/challenge`, which renders
   `Auth/TwoFactorChallenge`. It posts to `POST {prefix}/two-factor/challenge`
   (`escalated.two-factor.verify`) with either `code` or `recovery_code`.
   Success marks the session for that user ID, regenerates the session ID and
   redirects to the page they asked for. Failure returns a validation error on
   the field sent. The verify route is throttled (5 attempts per minute per
   user). JSON requests get 403 with `two_factor_required: true` instead of a
   redirect. Signing in again (the host's `Login` event) or out clears the mark,
   so every new login is challenged. Escalated does not own the host's
   password form; the challenge sits between the session and the panel.
4. **Recovery codes.** Eight single-use codes are issued at setup. A code that
   signs someone in is removed.
5. **Admins can require it.** `escalated.two_factor.required`
   (`ESCALATED_TWO_FACTOR_REQUIRED`, default `false`) and the runtime setting
   `two_factor_required` (Admin > Settings; the setting wins when present).
   When required, a staff user without a confirmed enrolment is redirected to
   the enrolment page and can use nothing else until they enrol.
6. An admin can clear a user's enrolment (lost device):
   `php artisan escalated:two-factor:reset {user}`.
7. Signing in through SSO does not skip the challenge.
8. The token API is not session-based and is not challenged.

### SSO: what "enforced" means

The provider is chosen at runtime in `Admin/Settings/SsoSettings`
(`sso_provider`: `none`, `saml`, `oauth`, `jwt`). With `none`, no sign-in
route works and `{prefix}/sso/login` answers 404.

Routes (all under `{prefix}`, web middleware, guests only):

| Route | Name | Use |
|---|---|---|
| `GET sso/login` | `escalated.sso.login` | Start sign-in with the configured provider |
| `GET sso/saml/metadata` | `escalated.sso.saml.metadata` | SP metadata XML; its URL is the default SP entity ID |
| `POST sso/saml/acs` | `escalated.sso.saml.acs` | SAML assertion consumer (HTTP-POST binding) |
| `GET sso/oauth/callback` | `escalated.sso.oauth.callback` | OAuth 2 / OIDC redirect URI |
| `GET\|POST sso/jwt/callback` | `escalated.sso.jwt.callback` | JWT hand-off (`jwt` parameter) |

**SAML** (Laravel: `onelogin/php-saml`, strict mode). A response is accepted
only if all of these hold, and refused otherwise:

- the IdP certificate (`sso_certificate`) is configured; without it every
  response is refused;
- the assertion is signed by that certificate (a signed Response alone is not
  enough); keys in `KeyInfo` are never trusted; exactly one assertion, and
  `EncryptedAssertion` is refused;
- `Issuer` equals `sso_entity_id`;
- `Audience` includes the SP entity ID (`escalated.sso.sp_entity_id`, default
  the metadata URL);
- the Response `Destination` and the bearer `SubjectConfirmationData`
  `Recipient` equal the ACS URL;
- `Conditions` and `SubjectConfirmationData` validity windows hold, with
  `escalated.sso.clock_skew` seconds of skew (default 120, max 300);
- `InResponseTo` is the ID of the AuthnRequest this session started
  (consumed on use). IdP-initiated (unsolicited) responses are refused unless
  `escalated.sso.allow_idp_initiated` is true (default false);
- the assertion `ID` has not been accepted before (replay). Used IDs are
  stored in `escalated_sso_replays` until their expiry plus skew.

**OAuth 2 / OIDC** (Laravel: `league/oauth2-client`). Authorization-code flow
with a single-use `state` bound to the session and PKCE (`S256`). The code is
exchanged at `sso_oauth_token_url` server to server, and the profile is read
from `sso_oauth_userinfo_url` with the access token. A missing or mismatched
`state`, or an IdP `error`, is refused.

**JWT** (Laravel: `firebase/php-jwt`). The token's `alg` must equal the
configured `sso_jwt_algorithm` (HS* with `sso_jwt_secret`, RS* with the
public key in `sso_jwt_secret`); `alg: none` and algorithm switching are
refused. `exp` is required, `nbf`/`iat` are honoured with skew, `aud` must
equal `escalated.sso.jwt_audience` (default the app URL), and `jti` is
required and single-use (stored in `escalated_sso_replays`).

**Provisioning and mapping** (all providers):

- The user's email comes from the `sso_attr_email` attribute or claim (SAML
  falls back to an email-shaped `NameID`), the name from `sso_attr_name`, the
  role from `sso_attr_role`.
- The user is matched to an existing host user by email, case-insensitively.
- No match: refused, unless `escalated.sso.create_users` is true (default
  false), in which case a host user is created with that email and name and an
  unusable random password.
- Role mapping: when roles & permissions is on and
  `escalated.sso.sync_roles` is true (default false), a role attribute naming
  an existing Escalated role slug replaces the user's roles with that role.
  An unknown value changes nothing. SSO never grants the host's admin or agent
  gate; it only signs the user in.
- On success the user is logged in on the host's default guard, the session ID
  is regenerated, and they are redirected to the intended URL (default the
  agent dashboard). Every refusal shows a generic error and logs the reason.

Escalated does not turn off the host's own password login; hosts that want
SSO-only do that in their app.

### Props the shared pages read

Shared `escalated` props on every page:

- `features.roles_permissions`, `features.two_factor`, `features.sso`: the
  switches (booleans). The layout hides **Roles** unless `roles_permissions`,
  and the settings links to SSO and two-factor unless their switch is on.
- `permissions`: with roles & permissions on, the signed-in user's slugs.
  With it off, `['*']` for a staff user (the gates decide everything) and `[]`
  for anyone else.
- `two_factor_required`: whether the signed-in staff user must enrol.

Page props:

- `Auth/TwoFactorChallenge`: `action` (absolute URL to post to), `error`
  (string, may be empty). Validation errors arrive on `code` or
  `recovery_code`.
- `Admin/Settings/TwoFactor`: `enabled`, `pending`, `required` (booleans);
  flashes `two_factor_setup {qr_uri, recovery_codes}` and
  `two_factor_confirmed {recovery_codes}`.
- `Admin/Settings/SsoSettings`: `settings` (the `sso_*` keys, secrets masked
  as `********`) plus read-only `endpoints {login, sp_entity_id, metadata,
  acs, oauth_redirect, jwt_callback}` for the admin to give the IdP.
- `Admin/Roles/Index` and `Admin/Roles/Form`: unchanged.

## Consequences

- escalated-laravel implements this in three releases' worth of PRs (roles,
  then two-factor, then SSO), each with HTTP tests for the switch on and off.
- Each port adds the three switches, defaults them off, and hides or 404s the
  screens until it enforces the feature. A port must not show a screen for a
  feature it does not enforce.
- The shared frontend hides the Roles, SSO and two-factor navigation entries
  from the `features` props.

### Upgrading an install that had configured these

- **Roles & permissions:** run `php artisan db:seed --class="Escalated\Laravel\Database\Seeders\PermissionSeeder"`
  so every permission exists, give every staff user a role (at least one
  `admin` via `escalated:roles:assign`), then set
  `ESCALATED_ROLES_PERMISSIONS=true`. Newsletter screens were the only screens
  that checked permissions before; with the switch off they now follow the
  admin gate alone, so installs that relied on `newsletters.*` to restrict
  admins must turn the switch on.
- **Two-factor:** run the migration, then set `ESCALATED_TWO_FACTOR=true`.
  Users who enrolled while it was unenforced are challenged from their next
  visit. Set `ESCALATED_TWO_FACTOR_REQUIRED=true` (or the setting) only after
  telling staff, since everyone without an enrolment is sent to enrol.
- **SSO:** run the migration, give the IdP the endpoints from the SSO page,
  make sure a SAML install has the IdP certificate, decide on
  `escalated.sso.create_users` and `sync_roles`, then set `ESCALATED_SSO=true`.

## Port test checklist

Every port proves each item with a test through its real HTTP stack.

**Switches**

- [ ] With each switch off (the default): its admin routes and sign-in routes
      answer 404, and shared `features.*` is false.
- [ ] With it on: the routes work and `features.*` is true.
- [ ] The switches are config/env only; posting a settings key with the same
      name changes nothing.

**Roles & permissions (switch on)**

- [ ] A staff user lacking a route's permission gets 403; with a role
      granting it, the route works. Cover at least one admin read, one admin
      write and one agent ticket action.
- [ ] `light_agent` can view a ticket and add a note but cannot assign,
      change priority, close or delete.
- [ ] A status change to `closed`/`resolved`/`reopened` needs `ticket.close`.
- [ ] Bulk actions check each action's permission.
- [ ] The staff API checks the token owner's permissions.
- [ ] Every admin/agent/staff API route is in the route-permission map
      (a test enumerates the router).
- [ ] Passing the admin gate without a role grants nothing.
- [ ] With the switch off, the same requests that got 403 succeed (gates only)
      and `permissions` is `['*']` for staff.

**Two-factor (switch on)**

- [ ] A staff user with confirmed 2FA is redirected from an admin and an agent
      page to the challenge; the challenge renders `Auth/TwoFactorChallenge`
      with `action`.
- [ ] A valid TOTP code passes and returns to the intended URL; an invalid
      one returns a `code` error; a reused code (same time step) is refused.
- [ ] A recovery code passes once and is refused the second time.
- [ ] The verify route is throttled.
- [ ] A new login is challenged again.
- [ ] An agent (not only an admin) can enrol.
- [ ] With 2FA required, a staff user without enrolment is redirected to
      enrolment and can reach nothing else; with it not required, they can.
- [ ] With the switch off, a user with a confirmed enrolment is not
      challenged and the enrolment routes answer 404.

**SSO (switch on)**

- [ ] SAML: a correctly signed response for the pending AuthnRequest signs in
      the matched user. Each of these is refused: no certificate configured;
      unsigned assertion; signed by another key; tampered after signing;
      wrong Issuer; wrong Audience; wrong Destination/Recipient; expired;
      unknown or missing InResponseTo (IdP-initiated off); the same assertion
      a second time.
- [ ] OAuth: a matching `state` with a successful token exchange and userinfo
      signs in the user; missing or mismatched `state` is refused; PKCE
      verifier is sent.
- [ ] JWT: a valid token signs in the user; refused for bad signature,
      `alg: none`, wrong algorithm, missing or past `exp`, wrong `aud`,
      missing `jti`, and a reused `jti`.
- [ ] An unknown email is refused when `create_users` is off and creates a
      user when it is on.
- [ ] Role mapping assigns the named role only with roles on and
      `sync_roles` on.
- [ ] `sso_provider = none` makes `sso/login` answer 404.
- [ ] With the switch off, every SSO route answers 404.

## Alternatives considered

- **Enforce everything unconditionally.** Rejected: it would lock out every
  existing install on upgrade (no one holds roles; enrolled users would
  suddenly be challenged) and fight hosts that do authorization, SSO or 2FA
  themselves.
- **Delete the screens.** Rejected: the owner wants the features; customers
  without their own stack need them.
- **Runtime switches in Admin > Settings.** Rejected for the three switches
  (see "Install-level only"). The settings inside each feature stay runtime.
- **Treat the admin gate as holding every permission.** Rejected: it would make
  roles meaningless for admins, and admins are the users roles most need to
  restrict (settings, webhooks, API tokens).
- **Hand-rolled TOTP, XML signature and JWT code.** Rejected: the existing
  hand-rolled SAML check verified one signature without the reference digests
  and nothing else. Maintained libraries cover the edge cases.
