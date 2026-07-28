#!/usr/bin/env bash
# clone-web skill installer
# Usage: bash install.sh

set -euo pipefail

SKILL="norat02/clone-web"
MIN_NODE=18

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${CYAN}${BOLD}[clone-web]${RESET} $*"; }
success() { echo -e "${GREEN}✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}⚠${RESET}  $*"; }
error()   { echo -e "${RED}✗${RESET} $*" >&2; }
die()     { error "$*"; exit 1; }

echo ""
echo -e "${BOLD}  clone-web skill installer${RESET}"
echo -e "  ${CYAN}npx skills@latest add ${SKILL}${RESET}"
echo ""

# ── Check Node.js ─────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  die "Node.js is not installed. Install it from https://nodejs.org (>= ${MIN_NODE} required)"
fi

NODE_VER=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_VER" -lt "$MIN_NODE" ]; then
  die "Node.js >= ${MIN_NODE} required (found ${NODE_VER}). Update at https://nodejs.org"
fi
success "Node.js ${NODE_VER} detected"

# ── Check npx ─────────────────────────────────────────────────────────────────
if ! command -v npx &>/dev/null; then
  die "npx not found. It ships with Node.js >= 5.2 — try updating Node.js."
fi
success "npx available"

# ── Check git ─────────────────────────────────────────────────────────────────
if ! command -v git &>/dev/null; then
  warn "git not found. Phase 4 parallel build (worktrees) requires git."
  warn "Install git from https://git-scm.com and re-run if you plan to use Option 1 (source code output)."
else
  success "git available"
fi

# ── Replit: set no-sandbox env ────────────────────────────────────────────────
if [ -n "${REPL_ID:-}" ]; then
  export CLONE_WEB_NO_SANDBOX=1
  info "Replit environment detected — CLONE_WEB_NO_SANDBOX=1 set automatically"
fi

# ── Install skill ─────────────────────────────────────────────────────────────
echo ""
info "Installing skill: ${SKILL}"
echo ""

npx skills@latest add "${SKILL}"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}  Installation complete!${RESET}"
echo ""
echo -e "  Usage in your AI agent:"
echo -e "  ${CYAN}/clone-web https://your-target-site.com${RESET}"
echo ""
echo -e "  Options after analysis:"
echo -e "  ${BOLD}Option 1${RESET} — Generate complete source code"
echo -e "  ${BOLD}Option 2${RESET} — Generate implementation prompt (Markdown)"
echo ""
echo -e "  Docs: ${CYAN}https://github.com/norat02/clone-web${RESET}"
echo ""
