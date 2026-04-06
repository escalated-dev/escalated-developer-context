# Release Process

How releases are managed across the Escalated platform.

## Versioning

All packages use [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0 -> 2.0.0) -- Breaking changes to the public API
- **MINOR** (1.0.0 -> 1.1.0) -- New features, backward-compatible
- **PATCH** (1.0.0 -> 1.0.1) -- Bug fixes, backward-compatible

During the 0.x phase (current), minor versions may include breaking changes.

## Release Workflow

### 1. Prepare the Release

1. Ensure all tests pass on the `main` branch
2. Update `CHANGELOG.md` with the new version and changes
3. Bump version in the package manifest:
   - PHP: `composer.json`
   - Python: `pyproject.toml`
   - Ruby: `version.rb` or `*.gemspec`
   - TypeScript: `package.json`
   - Go: Git tag only
   - Elixir: `mix.exs`
   - Dart: `pubspec.yaml`

### 2. Create the Release

```bash
git tag v0.5.0
git push origin v0.5.0
```

GitHub Actions handles the rest:
- CI runs the full test suite against the tag
- Package is published to the appropriate registry (npm, Packagist, PyPI, RubyGems, Hex)
- GitHub Release is created with changelog notes

### 3. Post-Release

1. Update `escalated-docs` if the release includes new features or config changes
2. Update `escalated-developer-context` if architecture or conventions changed
3. Announce in the appropriate channels

## Package Registries

| Package | Registry | Publish Trigger |
|---------|----------|----------------|
| escalated-laravel | Packagist | Git tag |
| escalated-django | PyPI | Git tag |
| escalated-rails | RubyGems | Git tag |
| escalated-adonis | npm | Git tag |
| escalated-plugin-sdk | npm | Git tag |
| escalated-plugin-runtime | npm | Git tag |
| escalated (frontend) | npm | Git tag |
| escalated-phoenix | Hex | Git tag |
| escalated-symfony | Packagist | Git tag |
| escalated-go | Go modules (proxy.golang.org) | Git tag |
| escalated-flutter | Git (pub.dev planned) | Git tag |
| escalated-wordpress | GitHub Releases (.zip) | Git tag |
| escalated-filament | Packagist | Git tag |

## CHANGELOG Format

Follow [Keep a Changelog](https://keepachangelog.com/):

```markdown
## [0.5.0] - 2026-04-05

### Added
- Skill-based ticket routing
- Agent capacity tracking
- Side conversations

### Changed
- SLA engine now respects business schedules

### Fixed
- Business hours calculation across DST transitions
- Round-robin assignment skipping offline agents

### Deprecated
- `config.sla.business_hours_only` (use business schedules instead)
```

## Coordinated Releases

Some changes span multiple repos. For example, a new plugin SDK feature may require updates to:

1. `escalated-plugin-sdk` (new API)
2. `escalated-plugin-runtime` (handle new messages)
3. `escalated-laravel` (bridge support)
4. `escalated-rails` (bridge support)
5. `escalated-django` (bridge support)
6. `escalated-docs` (documentation)

For coordinated releases:

1. Create feature branches in all affected repos
2. Test end-to-end with linked local packages
3. Release in dependency order:
   - SDK first (lowest dependency)
   - Runtime next (depends on SDK)
   - Backend packages (depend on runtime)
   - Docs last

## Hotfix Process

For critical bugs in production:

1. Branch from the latest tag: `git checkout -b fix/critical-bug v0.5.0`
2. Apply the fix
3. Add tests
4. Create a patch release: `v0.5.1`
5. Cherry-pick or merge the fix into `main`

## WordPress-Specific Release

WordPress releases include additional steps:

1. Build the `.zip` distribution package
2. Run Playwright screenshot tests
3. Upload `escalated.zip` to the GitHub Release
4. Screenshots are committed to the repo

The `screenshots.yml` workflow automates screenshot generation on every release.
