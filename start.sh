#!/usr/bin/env bash

# Auto Jira Agent - Cross-Platform Service Launcher (Linux / macOS)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================================"
echo "  Auto Jira Agent - Autonomous Multi-Agent System"
echo "========================================================"
echo ""

# 1. Check Node.js
if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] Node.js is not found in PATH!"
    echo "Please install Node.js (v18+) from https://nodejs.org/"
    exit 1
fi

# 2. Run cross-platform setup if dependencies missing
if [ ! -d "node_modules" ] || [ ! -d "server/node_modules" ] || [ ! -d "client/node_modules" ] || [ ! -d "agent_backend/.venv" ]; then
    echo "[INFO] Missing dependencies detected. Running setup..."
    node scripts/setup.js
fi

# 3. Read ports from environment or defaults
CLIENT_PORT="${CLIENT_PORT:-5173}"
SERVER_PORT="${SERVER_PORT:-4000}"
AGENT_PORT="${AGENT_PORT:-8000}"

echo "Starting all services concurrently with distinct port assignments:"
echo "  [1] Vite React UI:        http://localhost:${CLIENT_PORT}"
echo "  [2] Express API Server:   http://localhost:${SERVER_PORT}"
echo "  [3] Python Agent Backend: http://localhost:${AGENT_PORT}"
echo "  [4] Neo4j Database:       bolt://localhost:7687"
echo ""
echo "Press Ctrl+C to stop all services."
echo "========================================================"
echo ""

# Auto open browser after delay if on macOS or Linux with xdg-open
(
    sleep 3
    if command -v open >/dev/null 2>&1; then
        open "http://localhost:${CLIENT_PORT}" >/dev/null 2>&1 || true
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "http://localhost:${CLIENT_PORT}" >/dev/null 2>&1 || true
    fi
) &

npm run dev
