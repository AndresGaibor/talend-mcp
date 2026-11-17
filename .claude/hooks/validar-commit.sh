#!/bin/sh
# Gancho PreToolUse de Claude Code: bloquea `git commit` sin cierre `bun run verify` en verde.
# El JSON del evento llega por la entrada estandar; `validacion.ts guardia` lo interpreta.
set -u

raiz="${CLAUDE_PROJECT_DIR:-}"
if [ -n "$raiz" ]; then
    # En Windows, Claude puede dar una ruta nativa; el shell del gancho puede ser Git Bash o WSL.
    if command -v cygpath >/dev/null 2>&1; then
        raiz=$(cygpath -u "$raiz")
    elif command -v wslpath >/dev/null 2>&1; then
        raiz=$(wslpath -u "$raiz" 2>/dev/null || printf '%s' "$raiz")
    else
        raiz=$(printf '%s' "$raiz" | tr '\\' '/')
    fi
else
    raiz=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
fi
[ -n "$raiz" ] || exit 0
cd "$raiz" || exit 0

if command -v bun >/dev/null 2>&1; then
    bun_bin="bun"
elif [ -x "$HOME/.bun/bin/bun" ]; then
    bun_bin="$HOME/.bun/bin/bun"
else
    exit 0
fi

exec "$bun_bin" run scripts/validacion.ts guardia
