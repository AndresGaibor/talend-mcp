# Desinstala talend-mcp en Windows: quita la entrada de los clientes MCP, el PATH y los datos locales.
#   irm https://github.com/AndresGaibor/talend-mcp/releases/latest/download/uninstall.ps1 | iex
# Variables: TALEND_MCP_YES=1 (sin confirmacion), TALEND_MCP_KEEP_STATE=1 (conservar el historial)
$ErrorActionPreference = 'Stop'
$root = Join-Path $HOME '.talend-mcp'
$bin = Join-Path $root 'bin'
$exe = Join-Path $bin 'talend-mcp.exe'
$bridge = Join-Path $HOME '.talend-bridge'
$staging = if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'talend-mcp' } else { $null }

if (-not (Test-Path $root) -and -not (Test-Path $bridge)) {
  Write-Host "talend-mcp no esta instalado en este equipo."
  return
}

# Borra el binario y el historial locales: se confirma antes, salvo con TALEND_MCP_YES.
if (-not $env:TALEND_MCP_YES) {
  $answer = Read-Host "Se quitara talend-mcp de los clientes MCP y se borraran $root y $bridge. Continuar? [s/N]"
  if ($answer -notmatch '^(s|si|sí|y|yes)$') { Write-Host "Cancelado."; return }
}

if (Test-Path $exe) {
  Write-Host "Quitando talend-mcp de los clientes MCP..."
  & $exe remove
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "No se pudieron quitar todas las entradas de los clientes MCP."
    Write-Host "Revisa cada cliente a mano o ejecuta: talend-mcp remove --client <id>"
  }
} else {
  Write-Host "No se encontro el binario; se omite la limpieza de los clientes MCP."
}

# El instalador anadio esta carpeta al PATH de usuario: se quita para no dejar una ruta muerta.
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath) {
  $parts = @($userPath -split ';' | Where-Object { $_ -and $_.TrimEnd('\') -ne $bin.TrimEnd('\') })
  if ($parts.Count -lt @($userPath -split ';' | Where-Object { $_ }).Count) {
    [Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), 'User')
    Write-Host "Se quito $bin del PATH de usuario."
  }
}

try {
  if ($env:TALEND_MCP_KEEP_STATE) {
    if (Test-Path (Join-Path $root 'bin')) { Remove-Item (Join-Path $root 'bin') -Recurse -Force -ErrorAction Stop }
  } elseif (Test-Path $root) {
    Remove-Item $root -Recurse -Force -ErrorAction Stop
  }
  if (Test-Path $bridge) { Remove-Item $bridge -Recurse -Force -ErrorAction Stop }
  if ($staging -and (Test-Path $staging)) { Remove-Item $staging -Recurse -Force -ErrorAction Stop }
} catch {
  Write-Warning "No se pudieron borrar todos los archivos: $($_.Exception.Message)"
  Write-Host "Cierra los clientes MCP y los procesos de Talend Studio, y vuelve a ejecutar este comando."
  exit 1
}

Write-Host "talend-mcp desinstalado."
Write-Host "Abre una terminal nueva para que el PATH actualizado tenga efecto."
Write-Host "El plugin Bridge dentro de Talend Studio se quita desde Help > About > Installation Details > Installed Software (com.andres.talend.bridge)."
