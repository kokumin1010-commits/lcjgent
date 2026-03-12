#!/bin/sh
# Install Git hooks for the 4-Layer Defense System
# Run this after cloning the repository.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
HOOKS_DIR="$REPO_ROOT/.git/hooks"

# Install pre-push hook
cp "$SCRIPT_DIR/pre-push" "$HOOKS_DIR/pre-push"
chmod +x "$HOOKS_DIR/pre-push"
echo "[Dev Safety] Git pre-push hook installed successfully."
echo "  - Blocks pushes with >100 line deletions in any file"
echo "  - Bypass with: git push --no-verify"
