param(
  [Parameter(Mandatory = $true)][long]$Handle,
  [Parameter(Mandatory = $true)][string]$Button
)
# Pulsa un boton de un dialogo con accesibilidad de Windows. Salida: JSON {ok, pressed, via, error}.
# Primero InvokePattern; si el boton no lo admite, BM_CLICK sobre su ventana nativa (lo que escucha SWT).
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class ModalClick {
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  public static bool Click(long handle) { return PostMessage(new IntPtr(handle), 0x00F5, IntPtr.Zero, IntPtr.Zero); }
}
'@
function Norm([string]$s) { return ($s -replace '&', '' -replace '\s+', ' ').Trim().ToLowerInvariant() }
function Out-Json($ok, $pressed, $via, $err) {
  ConvertTo-Json -Compress -InputObject ([pscustomobject]@{ ok = $ok; pressed = $pressed; via = $via; error = $err })
}
try {
  $win = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$Handle)
  $items = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  $wanted = Norm $Button
  $target = $null
  for ($i = 0; $i -lt $items.Count; $i++) {
    $el = $items.Item($i)
    $isButton = ($el.Current.ControlType.ProgrammaticName -eq 'ControlType.Button') -or ($el.Current.ClassName -eq 'Button')
    if ($isButton -and (Norm $el.Current.Name) -eq $wanted) { $target = $el; break }
  }
  if ($null -eq $target) { Out-Json $false $null $null 'boton no encontrado'; exit 0 }
  $pattern = $null
  if ($target.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pattern)) {
    $pattern.Invoke()
    Out-Json $true $Button 'invoke' $null; exit 0
  }
  $native = $target.Current.NativeWindowHandle
  if ($native -ne 0 -and [ModalClick]::Click([long]$native)) {
    Out-Json $true $Button 'bm_click' $null; exit 0
  }
  Out-Json $false $null $null 'el boton no admite Invoke ni tiene ventana nativa'
} catch {
  Out-Json $false $null $null $_.Exception.Message
}
