#!/usr/bin/env sh
# Instala o actualiza talend-mcp en Linux o macOS (volver a ejecutarlo actualiza).
#   curl -fsSL https://github.com/AndresGaibor/talend-mcp/releases/latest/download/install.sh | sh
# Variables: TALEND_MCP_RELEASE_URL (otra fuente), TALEND_MCP_NO_SETUP=1
set -eu
BASE="${TALEND_MCP_RELEASE_URL:-https://github.com/AndresGaibor/talend-mcp/releases/latest/download}"
case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) ASSET=talend-mcp-linux-x64 ;;
  Darwin-arm64) ASSET=talend-mcp-darwin-arm64 ;;
  Darwin-x86_64) ASSET=talend-mcp-darwin-x64 ;;
  *) echo "Plataforma no soportada: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac
DIR="$HOME/.talend-mcp/bin"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
mkdir -p "$DIR"

echo "Descargando $ASSET ..."
curl -fsSL "$BASE/$ASSET" -o "$TMP"

# Sin checksum no se instala: el binario corre con acceso a tus proyectos.
EXPECTED="$(curl -fsSL "$BASE/checksums.txt" | awk -v a="$ASSET" '$2 == a || $2 == "*" a { print $1; exit }')"
[ -n "$EXPECTED" ] || { echo "checksums.txt no lista $ASSET" >&2; exit 1; }
if command -v sha256sum >/dev/null 2>&1; then ACTUAL="$(sha256sum "$TMP" | awk '{print $1}')"; else ACTUAL="$(shasum -a 256 "$TMP" | awk '{print $1}')"; fi
[ "$ACTUAL" = "$EXPECTED" ] || { echo "El checksum no coincide (esperado $EXPECTED, obtenido $ACTUAL). No se instala." >&2; exit 1; }

chmod +x "$TMP"
mv -f "$TMP" "$DIR/talend-mcp"
echo "Instalado: $DIR/talend-mcp ($("$DIR/talend-mcp" version))"
case ":$PATH:" in *":$DIR:"*) ;; *) echo "Anade $DIR al PATH:  export PATH=\"$DIR:\$PATH\"" ;; esac
[ -n "${TALEND_MCP_NO_SETUP:-}" ] || "$DIR/talend-mcp" setup
echo "Listo. Pide al asistente: ejecuta talend_guide con mode overview."
echo "Para trabajar en vivo con Studio, cierralo y ejecuta: talend-mcp bridge install"
