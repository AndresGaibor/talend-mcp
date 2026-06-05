#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BRIDGE_DIR="$SCRIPT_DIR"
REPO_DIR="$BRIDGE_DIR/com.andres.talend.bridge.repository/target/repository"
TALEND_STUDIO_DIR="/Applications/TalendStudio-8.0.1/studio"
STUDIO_APP="$TALEND_STUDIO_DIR/Talend-Studio-macosx-cocoa-aarch64.app/Contents/MacOS/Talend-Studio-macosx-cocoa"

echo "=== Talend Studio Bridge — Build & Install ==="
echo ""

# Paso 1: Build de Maven
echo "[1/4] Compilando proyecto Maven (Tycho)..."
cd "$BRIDGE_DIR"
mvn clean verify -DskipTests -q
echo "      ✓ Build completado"

# Paso 2: Verificar que el update site existe
echo ""
echo "[2/4] Verificando update site..."
if [ ! -d "$REPO_DIR" ]; then
  echo "ERROR: No se encontró el update site en $REPO_DIR"
  exit 1
fi
echo "      ✓ Update site encontrado en $REPO_DIR"

# Paso 3: Detectar si Talend Studio está corriendo
echo ""
echo "[3/4] Verificando Talend Studio..."
if pgrep -fl "Talend-Studio" > /dev/null 2>&1; then
  echo "ADVERTENCIA: Talend Studio está corriendo."
  echo ""
  read -p "¿Cerrar Talend Studio ahora? (s/n): " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo "      Cerrando Talend Studio..."
    pkill -f "Talend-Studio" || true
    sleep 2
    echo "      ✓ Talend Studio cerrado"
  else
    echo "ERROR: No se puede instalar mientras Talend Studio está corriendo."
    exit 1
  fi
else
  echo "      ✓ Talend Studio no está corriendo"
fi

# Paso 4: Instalar usando p2 director
echo ""
echo "[4/4] Instalando plugin en Talend Studio..."
"$STUDIO_APP" \
  -application org.eclipse.equinox.p2.director \
  -repository "file://$REPO_DIR" \
  -installIU com.andres.talend.bridge.feature.feature.group \
  -destination "$TALEND_STUDIO_DIR" \
  -profileProperties org.eclipse.update.install.features=true \
  -nosplash \
  -console \
2>&1 | grep -v "^WARNING:" || true

echo ""
echo "=== Instalación completada ==="
echo ""
echo "Puedes abrir Talend Studio ahora."
echo ""
echo "Para verificar que el bridge está instalado:"
echo "  1. Abre Talend Studio"
echo "  2. Ve a Help > About Talend Studio > Installation Details"
echo "  3. Busca 'Talend Bridge' en la lista de features"
