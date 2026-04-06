# escalated-flutter

[![Tests](https://github.com/escalated-dev/escalated-flutter/actions/workflows/run-tests.yml/badge.svg)](https://github.com/escalated-dev/escalated-flutter/actions/workflows/run-tests.yml)

**Language**: Dart | **Framework**: Flutter 3.16+ | **Package**: Git dependency

A customer-facing support ticket UI for Flutter apps. Drop it into any Flutter project to get ticket management, knowledge base, guest access, and SLA tracking.

## Installation

```yaml
# pubspec.yaml
dependencies:
  escalated:
    git:
      url: https://github.com/escalated-dev/escalated-flutter.git
```

## Quick Start

```dart
import 'package:escalated/escalated.dart';

EscalatedPlugin(
  config: EscalatedConfig(
    apiBaseUrl: 'https://yourapp.com/support/api/v1',
  ),
  child: MaterialApp.router(...),
)
```

## Features

- Ticket management (create, view, filter, reply with file attachments)
- Knowledge base (searchable articles with HTML rendering)
- Guest tickets (anonymous submission without auth)
- SLA tracking (real-time countdown timers)
- Satisfaction ratings (post-resolution CSAT)
- Auth hooks (override login, logout, register, token retrieval)
- Riverpod state management
- GoRouter-compatible navigation
- Dark mode support
- i18n (English, Spanish, French, German)

## Directory Structure

```
lib/
├── escalated.dart           # Public API exports
├── config/                  # Configuration
├── models/                  # Data models
├── providers/               # Riverpod providers
├── screens/                 # Screen widgets
│   ├── ticket_list.dart
│   ├── ticket_detail.dart
│   ├── create_ticket.dart
│   ├── knowledge_base.dart
│   └── ...
├── widgets/                 # Reusable widgets
├── services/                # API service layer
├── theme/                   # Theme configuration
└── l10n/                    # Localization

example/                     # Example Flutter app
```

## Configuration

```dart
EscalatedConfig(
  apiBaseUrl: 'https://yourapp.com/support/api/v1',
  primaryColor: Colors.blue,
  borderRadius: 12.0,
  darkMode: false,
  defaultLocale: 'en',
  onLogin: (context) => Navigator.pushNamed(context, '/login'),
  onLogout: (context) => authService.logout(),
  getToken: () => authService.currentToken,
)
```

## How It Connects

The Flutter SDK is a REST API client. It connects to any Escalated backend (Laravel, Rails, Django, AdonisJS, WordPress, etc.) via the `/api/v1` endpoints. Authentication is handled through configurable hooks -- the SDK does not implement its own auth flow.

## Running Tests

```bash
flutter test
```

Uses Flutter's built-in test framework with Mocktail for mocking.
