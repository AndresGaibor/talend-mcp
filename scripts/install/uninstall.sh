#!/usr/bin/env sh
# Desinstala talend-mcp en Linux o macOS: quita la entrada de los clientes MCP y los datos locales.
#   curl -fsSL https://github.com/AndresGaibor/talend-mcp/releases/latest/download/uninstall.sh | sh
# Variables: TALEND_MCP_YES=1 (sin confirmacion), TALEND_MCP_KEEP_STATE=1 (conservar el historial)
set -eu
ROOT="$HOME/.talend-mcp"
BIN="$ROOT/bin"
EXE="$BIN/talend-mcp"
BRIDGE="$HOME/.talend-bridge"

if [ ! -d "$ROOT" ] && [ ! -d "$BRIDGE" ]; then
  echo "talend-mcp no esta instalado en este equipo."
  exit 0
fi

# Borra el binario y el historial locales: se confirma antes, salvo con TALEND_MCP_YES.
if [ -z "${TALEND_MCP_YES:-}" ]; then
  ANSWER=""
  if [ -r /dev/tty ]; then
    printf "Se quitara talend-mcp de los clientes MCP y se borraran %s y %s. Continuar? [s/N] " "$ROOT" "$BRIDGE" >/dev/tty
    IFS= read -r ANSWER </dev/tty || ANSWER=""
  fi
  case "$ANSWER" in
    s|S|si|Si|sí|Sí|y|Y|yes|Yes) ;;
    *) echo "Cancelado."; exit 0 ;;
  esac
fi

if [ -x "$EXE" ]; then
  echo "Quitando talend-mcp de los clientes MCP..."
  if ! "$EXE" remove; then
    echo "No se pudieron quitar todas las entradas de los clientes MCP." >&2
    echo "Revisa cada cliente a mano o ejecuta: talend-mcp remove --client <id>" >&2
  fi
else
  echo "No se encontro el binario; se omite la limpieza de los clientes MCP."
fi

if [ -n "${TALEND_MCP_KEEP_STATE:-}" ]; then
  rm -rf "$BIN"
else
  rm -rf "$ROOT"
fi
rm -rf "$BRIDGE"

echo "talend-mcp desinstalado."
echo "Quita $BIN del PATH de tu shell si lo anadiste a mano."
echo "El plugin Bridge dentro de Talend Studio se quita desde Help > About > Installation Details > Installed Software (com.andres.talend.bridge)."
