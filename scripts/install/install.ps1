# Instala o actualiza talend-mcp en Windows (volver a ejecutarlo actualiza).
#   irm https://github.com/AndresGaibor/talend-mcp/releases/latest/download/install.ps1 | iex
# Variables: TALEND_MCP_RELEASE_URL (otra fuente), TALEND_MCP_NO_PATH=1, TALEND_MCP_NO_SETUP=1
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$base = if ($env:TALEND_MCP_RELEASE_URL) { $env:TALEND_MCP_RELEASE_URL.TrimEnd('/') } else { 'https://github.com/AndresGaibor/talend-mcp/releases/latest/download' }
$asset = 'talend-mcp-windows-x64.exe'
$dir = Join-Path $HOME '.talend-mcp\bin'
$exe = Join-Path $dir 'talend-mcp.exe'
$tmp = Join-Path ([IO.Path]::GetTempPath()) ("talend-mcp-" + [guid]::NewGuid() + '.exe')

New-Item -ItemType Directory -Force $dir | Out-Null
Write-Host "Descargando $asset ..."
Invoke-WebRequest "$base/$asset" -OutFile $tmp -UseBasicParsing

# Sin checksum no se instala: el binario corre con acceso a tus proyectos.
$sums = (Invoke-WebRequest "$base/checksums.txt" -UseBasicParsing).Content
if ($sums -is [byte[]]) { $sums = [Text.Encoding]::UTF8.GetString($sums) }
$line = ($sums -split "`n" | Where-Object { $_ -match [regex]::Escape($asset) } | Select-Object -First 1)
if (-not $line) { Remove-Item $tmp -Force; throw "checksums.txt no lista $asset" }
$expected = ($line.Trim() -split '\s+')[0].ToLower()
$actual = (Get-FileHash $tmp -Algorithm SHA256).Hash.ToLower()
if ($actual -ne $expected) { Remove-Item $tmp -Force; throw "El checksum no coincide (esperado $expected, obtenido $actual). No se instala." }

try { Move-Item -Force $tmp $exe } catch { Remove-Item $tmp -Force; throw "No se pudo reemplazar $exe. Cierra el cliente MCP que lo tenga abierto y repite. ($_)" }
Write-Host "Instalado: $exe ($(& $exe version))"

if (-not $env:TALEND_MCP_NO_PATH) {
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  if (($userPath -split ';') -notcontains $dir) {
    [Environment]::SetEnvironmentVariable('Path', ($userPath.TrimEnd(';') + ';' + $dir), 'User')
    Write-Host "Se anadio $dir al PATH de usuario (abre una terminal nueva)."
  }
}
if (-not $env:TALEND_MCP_NO_SETUP) { & $exe setup }
Write-Host "Listo. Siguiente paso: pide al asistente 'ejecuta talend_guide con mode overview'."
