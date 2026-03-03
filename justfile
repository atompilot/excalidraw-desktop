# Excalidraw Desktop App - Build Recipes
# Usage: just <recipe>

# Show all available commands
default:
    @just --list

# Start development mode (hot reload)
dev:
    cd desktop-app && yarn exec tauri dev

# Production build (unsigned)
build:
    cd desktop-app && yarn exec tauri build

# Build .dmg only
build-dmg:
    cd desktop-app && yarn exec tauri build --bundles dmg

# Build Universal Binary (Intel + Apple Silicon)
build-universal:
    cd desktop-app && yarn exec tauri build --target universal-apple-darwin

# Signed + notarized build (requires env vars)
build-signed:
    #!/usr/bin/env bash
    set -euo pipefail
    _check_signing_env
    cd desktop-app && yarn exec tauri build --bundles dmg

# Signed Universal Binary + notarized
build-signed-universal:
    #!/usr/bin/env bash
    set -euo pipefail
    _check_signing_env
    cd desktop-app && yarn exec tauri build --target universal-apple-darwin --bundles dmg

# Clean all build artifacts
clean: clean-tauri
    rm -rf desktop-app/build

# Clean Rust build artifacts only
clean-tauri:
    rm -rf desktop-app/src-tauri/target

# Install all dependencies (Node + Rust)
setup:
    yarn install
    cd desktop-app/src-tauri && cargo fetch

# Check that required development tools are installed
check-tools:
    #!/usr/bin/env bash
    set -euo pipefail
    ok=true
    check() {
        if command -v "$1" &>/dev/null; then
            printf "  %-12s %s\n" "$1" "$(command -v "$1")"
        else
            printf "  %-12s MISSING\n" "$1"
            ok=false
        fi
    }
    echo "Checking required tools..."
    check node
    check yarn
    check rustc
    check cargo
    check just
    echo ""
    if [ "$ok" = true ]; then
        echo "All tools installed."
    else
        echo "Some tools are missing. Please install them before proceeding."
        exit 1
    fi

# Show build output paths
show-output:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "Build output directory:"
    echo "  desktop-app/src-tauri/target/release/bundle/"
    echo ""
    if [ -d "desktop-app/src-tauri/target/release/bundle" ]; then
        echo "Contents:"
        ls -la desktop-app/src-tauri/target/release/bundle/
    else
        echo "(No build output found. Run 'just build' first.)"
    fi

# Internal: verify signing environment variables are set
_check_signing_env:
    #!/usr/bin/env bash
    set -euo pipefail
    missing=()
    for var in APPLE_SIGNING_IDENTITY APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID; do
        if [ -z "${!var:-}" ]; then
            missing+=("$var")
        fi
    done
    if [ ${#missing[@]} -gt 0 ]; then
        echo "Error: Missing required environment variables for signed build:"
        for var in "${missing[@]}"; do
            echo "  - $var"
        done
        echo ""
        echo "Required variables:"
        echo "  APPLE_SIGNING_IDENTITY  - e.g. 'Developer ID Application: Splat AI INC (D9V25D8RBJ)'"
        echo "  APPLE_ID                - Apple ID email"
        echo "  APPLE_PASSWORD          - App-specific password"
        echo "  APPLE_TEAM_ID           - Team ID (D9V25D8RBJ)"
        exit 1
    fi
    echo "Signing environment OK."
