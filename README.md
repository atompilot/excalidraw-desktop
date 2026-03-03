# Excalidraw Desktop

A native macOS desktop application built on top of [Excalidraw](https://github.com/excalidraw/excalidraw), the open-source virtual whiteboard. This fork adds a Tauri-based desktop shell, system font rendering, canvas-native markdown support, annotation tools, and an MCP server for AI integration.

## What's Different from Excalidraw

This project is a fork of [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) with the following additions and improvements:

### Native Desktop App (Tauri v2)

- **Native macOS app** — Built with [Tauri v2](https://v2.tauri.app/) (Rust + WebView), resulting in a lightweight ~15MB app instead of an Electron-based 200MB+ bundle
- **File associations** — Double-click `.excalidraw` files to open them directly
- **Native file dialogs** — Open/Save/Export using system file picker
- **Recent files** — Tracks recently opened files with SQLite storage
- **Session state persistence** — Remembers your workspace state across launches
- **Custom context menu** — Right-click to copy file path or element IDs

### Canvas-Native Markdown Rendering

- **Markdown in text elements** — Text elements support markdown formatting (headings, bold, code blocks) rendered directly on the canvas
- **Proper z-ordering** — Unlike HTML overlay approaches, markdown renders at the correct layer in the element stack using an SVG foreignObject → Canvas Image pipeline
- **Two-phase rendering** — Shows plain text immediately, then replaces with rich markdown after async processing completes
- **Built-in parser** — No external markdown library dependency; uses a lightweight built-in parser

### System Font Support

- **System UI font family** — Added `System-UI` as a font option, using the native system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", ...`)
- **Default font changed** — Desktop app defaults to system fonts instead of Excalifont for better readability in technical/annotation use cases

### Annotation Mode

- **Numbered markers** — Click to place numbered annotation markers on the canvas
- **Annotation toolbar** — Dedicated toolbar for creating and managing annotations
- **Summary generation** — Auto-generate text summaries of all annotations
- **Sync with scene** — Counter stays in sync when annotations are manually deleted

### Dimension Overlay

- **Element measurements** — Select elements to see their width, height, and position
- **Gap measurement** — Select two elements to see the spacing between them
- **Solidify to canvas** — Convert temporary dimension overlays into permanent canvas elements

### UI Templates Sidebar

- **Pre-built component templates** — Buttons, cards, inputs, layouts, modals, navigation components
- **One-click insertion** — Click a template to insert it as Excalidraw elements on the canvas
- **Extensible system** — Easy to add new template categories and components

### MCP Server Integration

- **Built-in MCP server** — HTTP-based [Model Context Protocol](https://modelcontextprotocol.io/) server runs inside the desktop app
- **AI-powered drawing** — Claude or other AI agents can create, read, modify, and delete elements programmatically
- **Annotation tools** — MCP tools for creating and managing annotations
- **Export capabilities** — Export scenes as PNG/SVG via MCP commands
- **Claude Code bridge** — Send screenshots and context directly to Claude Code

### Build & Release Infrastructure

- **justfile** — Local build recipes for dev, build, sign, and clean operations
- **GitHub Actions CI/CD** — Automated universal binary (.dmg) builds with code signing and notarization on tag push
- **Universal Binary** — Supports both Apple Silicon and Intel Macs

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Yarn](https://yarnpkg.com/) 4.x
- [Rust](https://rustup.rs/) stable
- [just](https://github.com/casey/just) (optional, for build recipes)

### Development

```bash
# Install dependencies
yarn install

# Start development mode (hot reload)
just dev
# or without just:
cd desktop-app && yarn exec tauri dev
```

### Build

```bash
# Check that all tools are installed
just check-tools

# Build .dmg (unsigned, for local testing)
just build-dmg

# Build Universal Binary (Intel + Apple Silicon)
just build-universal

# Show build output location
just show-output
```

### All Build Recipes

| Command | Description |
|---------|-------------|
| `just dev` | Start dev mode with hot reload |
| `just build` | Production build (unsigned) |
| `just build-dmg` | Build .dmg only |
| `just build-universal` | Build Universal Binary |
| `just build-signed` | Signed + notarized build |
| `just build-signed-universal` | Signed Universal Binary + notarized |
| `just clean` | Clean all build artifacts |
| `just clean-tauri` | Clean Rust build artifacts only |
| `just setup` | Install Node + Rust dependencies |
| `just check-tools` | Verify dev tools are installed |
| `just show-output` | Show build output paths |

## Release Process

### Automated Release (CI/CD)

Push a tag to trigger the GitHub Actions workflow:

```bash
git tag desktop-v1.0.0
git push origin desktop-v1.0.0
```

The workflow will:
1. Build a Universal Binary (.dmg) on macOS
2. Code sign with Developer ID certificate
3. Notarize with Apple
4. Create a Draft Release on GitHub with the .dmg attached

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `MACOS_CERTIFICATE` | Base64-encoded .p12 certificate |
| `MACOS_CERTIFICATE_PWD` | Certificate export password |
| `NOTARIZE_APPLE_ID` | Apple ID email for notarization |
| `NOTARIZE_APPLE_ID_PASSWORD` | App-specific password |

## Project Structure

```
excalidraw-desktop/
├── desktop-app/              # Tauri desktop application
│   ├── App.tsx               # Main React component with desktop features
│   ├── components/           # Desktop-specific React components
│   │   ├── AnnotationToolbar.tsx
│   │   ├── DimensionOverlay.tsx
│   │   └── UITemplatesSidebar.tsx
│   ├── mcp-server/           # Built-in MCP server
│   │   └── src/tools/        # MCP tool implementations
│   ├── ui-templates/         # Pre-built UI component templates
│   ├── src-tauri/            # Rust backend (Tauri)
│   │   ├── src/commands/     # Tauri commands (file I/O, clipboard, etc.)
│   │   └── src/mcp_http.rs   # MCP HTTP server
│   └── vite.config.mts       # Vite config for desktop app
├── packages/                  # Core Excalidraw packages (from upstream)
│   ├── excalidraw/           # Main editor component
│   ├── element/              # Element types and rendering
│   ├── common/               # Shared constants and utilities
│   ├── math/                 # Math utilities
│   └── utils/                # General utilities
├── excalidraw-app/           # Web app (from upstream)
├── justfile                  # Build recipes
└── .github/workflows/
    └── desktop-release.yml   # CI/CD for macOS builds
```

## Syncing with Upstream

This fork tracks [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw). To pull in upstream updates:

```bash
git fetch origin          # origin = excalidraw/excalidraw
git checkout master
git merge origin/master
git push fork master
```

## Credits

- [Excalidraw](https://github.com/excalidraw/excalidraw) — The open-source whiteboard this project is built on
- [Tauri](https://tauri.app/) — The Rust framework powering the native desktop shell

## License

MIT — Same as the upstream Excalidraw project.
