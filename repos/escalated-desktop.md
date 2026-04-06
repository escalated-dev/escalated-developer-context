# escalated-desktop

[![Build](https://github.com/escalated-dev/escalated-desktop/actions/workflows/build.yml/badge.svg)](https://github.com/escalated-dev/escalated-desktop/actions/workflows/build.yml)

**Language**: Rust + Yew (WASM) | **Framework**: Tauri v2 | **Platforms**: Windows, macOS, Linux

A multi-site support ticket management desktop app. Manage tickets across multiple Escalated instances from a single native application.

## Tech Stack

- **Desktop framework**: Tauri v2 (Rust backend)
- **Frontend**: Yew.rs (Rust compiled to WASM)
- **Styling**: Tailwind CSS
- **Credentials**: OS keychain via `keyring` crate

## Features

- Multi-site management (connect to multiple Escalated instances)
- Agent dashboard with ticket list and detail views
- Reply, assign, change status from the desktop
- API keys stored securely in the OS keychain
- WebSocket real-time updates with polling fallback
- System tray with notification badges

## Directory Structure

```
src/                        # Yew frontend (Rust -> WASM)
├── main.rs
├── app.rs
├── components/
├── pages/
├── services/
└── models/

src-tauri/                  # Tauri backend (Rust)
├── src/
│   ├── main.rs
│   ├── commands.rs         # Tauri IPC commands
│   ├── keychain.rs         # OS keychain integration
│   └── ...
├── Cargo.toml
└── tauri.conf.json

index.html                  # Entry point
styles/                     # Tailwind CSS
Cargo.toml                  # Workspace Cargo.toml
Trunk.toml                  # Trunk (WASM build) config
package.json                # npm (Tailwind CSS only)
tailwind.config.js
```

## Prerequisites

- Rust + Cargo
- WASM target (`rustup target add wasm32-unknown-unknown`)
- Trunk (`cargo install trunk`)
- Tauri CLI (`cargo install tauri-cli`)
- Node.js + npm (for Tailwind CSS)

## Development

```bash
cargo tauri dev
```

## Building

```bash
cargo tauri build
```

Produces platform-native installers (`.msi` for Windows, `.dmg` for macOS, `.deb`/`.AppImage` for Linux).

## How It Connects

The desktop app connects to Escalated instances via the REST API. Each site is configured with:
- Base URL (e.g., `https://myapp.com/support/api/v1`)
- API key (stored in OS keychain)

The app calls the same API endpoints that the web UI and mobile SDK use.
