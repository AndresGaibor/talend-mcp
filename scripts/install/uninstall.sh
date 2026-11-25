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
  echo "No se encontro la instalacion local de talend-mcp."
  echo "Si el plugin Bridge sigue en Talend Studio, quitalo desde Help > About > Installation Details > Installed Software (com.andres.talend.bridge)."
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

# El plugin vive dentro de Talend Studio: se quita con p2 y necesita Studio cerrado.
PLUGIN_PENDIENTE=0
if [ -x "$EXE" ]; then
  echo "Quitando el plugin Bridge de Talend Studio..."
  status=0
  "$EXE" bridge uninstall || status=$?
  if [ "$status" -eq 2 ]; then
    PLUGIN_PENDIENTE=1
    echo "Esta version del binario no sabe quitar el plugin; actualiza con install.sh y vuelve a ejecutar." >&2
  elif [ "$status" -ne 0 ]; then
    PLUGIN_PENDIENTE=1
    echo "El plugin Bridge sigue instalado (o Talend Studio estaba abierto)." >&2
    echo "Cierra Talend Studio y ejecuta: talend-mcp bridge uninstall" >&2
  fi
else
  PLUGIN_PENDIENTE=1
fi

if [ -n "${TALEND_MCP_KEEP_STATE:-}" ]; then
  rm -rf "$BIN"
else
  rm -rf "$ROOT"
fi
rm -rf "$BRIDGE"

echo "talend-mcp desinstalado."
echo "Quita $BIN del PATH de tu shell si lo anadiste a mano."
if [ "$PLUGIN_PENDIENTE" -eq 1 ]; then
  echo "El plugin Bridge sigue en Talend Studio: quitalo desde Help > About > Installation Details > Installed Software (com.andres.talend.bridge)."
fi
