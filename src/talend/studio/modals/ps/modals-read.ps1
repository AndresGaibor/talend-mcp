param([Parameter(Mandatory = $true)][int]$ProcessId, [switch]$IncludeMain)
# Lee los dialogos abiertos de un proceso con accesibilidad de Windows (UI Automation).
# No pulsa nada. Salida: JSON con titulo, mensajes, botones y numero de campos editables o de contrasena.
# `-IncludeMain` solo sirve para probar con un proceso de una sola ventana.
# Un control se reconoce por su tipo UIA o, si el dialogo lo expone como Pane (MessageBox nativo),
# por su clase de Windows: Button, Static, Edit.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type -TypeDefinition @'
using System; using System.Collections.Generic; using System.Runtime.InteropServices;
public static class ModalWin {
  delegate bool Cb(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(Cb c, IntPtr l);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  public static List<long> Top(uint pid) {
    var r = new List<long>();
    EnumWindows((h, l) => { uint o; GetWindowThreadProcessId(h, out o); if (o == pid && IsWindowVisible(h)) r.Add(h.ToInt64()); return true; }, IntPtr.Zero);
    return r;
  }
}
'@
$main = (Get-Process -Id $ProcessId).MainWindowHandle.ToInt64()
$AE = [System.Windows.Automation.AutomationElement]
$result = @()
foreach ($h in [ModalWin]::Top([uint32]$ProcessId)) {
  if ($h -eq $main -and -not $IncludeMain) { continue }
  try { $win = $AE::FromHandle([IntPtr]$h) } catch { continue }
  $texts = New-Object System.Collections.ArrayList
  $buttons = New-Object System.Collections.ArrayList
  $editable = 0; $password = 0
  $items = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  $count = [Math]::Min($items.Count, 400)
  for ($i = 0; $i -lt $count; $i++) {
    $el = $items.Item($i)
    $type = $el.Current.ControlType.ProgrammaticName
    $class = $el.Current.ClassName
    $name = $el.Current.Name
    if ($type -eq 'ControlType.Button' -or $class -eq 'Button') {
      if ($name) { [void]$buttons.Add($name) }
    }
    elseif ($type -eq 'ControlType.Edit' -or $type -eq 'ControlType.Document' -or $class -eq 'Edit') {
      if ($el.Current.IsPassword) { $password++; continue }
      $value = $null
      $pattern = $null
      if ($el.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$pattern)) {
        if ($pattern.Current.IsReadOnly) { $value = $pattern.Current.Value } else { $editable++ }
      } else { $editable++ }
      if ($value -and $value.Trim()) { [void]$texts.Add($value.Trim()) }
    }
    elseif ($type -eq 'ControlType.Text' -or $class -eq 'Static' -or $class -eq 'SysLink' -or $type -eq 'ControlType.Pane') {
      if ($name -and $name.Trim()) { [void]$texts.Add($name.Trim()) }
    }
  }
  if ($buttons.Count -eq 0) { continue }   # sin botones no es un dialogo (tooltip, ventana auxiliar)
  $result += [pscustomobject]@{
    handle = $h; title = $win.Current.Name; texts = @($texts | Select-Object -Unique); buttons = @($buttons)
    editableFields = $editable; passwordFields = $password
  }
}
if ($result.Count -eq 0) { '[]' } else { ConvertTo-Json -InputObject @($result) -Depth 4 -Compress }
