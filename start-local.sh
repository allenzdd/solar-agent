#!/bin/sh
set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$PROJECT_ROOT"

if [ -n "${NODE_EXE:-}" ]; then
    NODE_BIN=$NODE_EXE
elif command -v node >/dev/null 2>&1; then
    NODE_BIN=$(command -v node)
else
    printf '%s\n' 'Node.js 20.12+ is required. Install Node.js or set NODE_EXE to its executable path.' >&2
    exit 1
fi

if [ ! -x "$NODE_BIN" ]; then
    printf '%s\n' 'NODE_EXE must point to an executable Node.js binary.' >&2
    exit 1
fi

exec "$NODE_BIN" "$PROJECT_ROOT/scripts/local-deploy.mjs"
