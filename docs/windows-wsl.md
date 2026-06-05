# Windows/WSL Setup Guide

## Windows PowerShell

```powershell
$env:TALEND_PROJECT="C:\Users\User\Talend\workspace\PROJECT"
$env:TALEND_HOST_OS="windows"
$env:TALEND_PATH_MODE="native"
bun run start:server
```

## WSL (Windows Subsystem for Linux)

```bash
export TALEND_PROJECT="/mnt/c/Users/User/Talend/workspace/PROJECT"
export TALEND_HOST_OS="windows"
export TALEND_PATH_MODE="wsl-windows"
bun run start:server
```

## Path Conversion Between WSL and Windows Talend Studio

When running WSL, the MCP server needs to communicate with Talend Studio running on Windows. The path conversion works as follows:

| WSL Path | Windows Path |
|----------|--------------|
| `/mnt/c/Users/User/Talend/workspace/PROJECT` | `C:\Users\User\Talend\workspace\PROJECT` |

### How `wsl-windows` Path Mode Works

1. **Project path**: When Talend Studio runs on Windows and the MCP server runs in WSL, the project files are accessed from Windows paths mounted under `/mnt/c/`.

2. **Talend command translation**: The MCP server automatically converts WSL paths to Windows paths when invoking Talend Studio commands, because Talend Studio runs natively on Windows and expects Windows-style paths.

3. **Path conversion rules**:
   - `/mnt/c/` prefix is stripped and converted to `C:\`
   - Forward slashes are converted to backslashes
   - Example: `/mnt/c/Users/User/Talend` → `C:\Users\User\Talend`

4. **Talend Studio execution**: Talend Studio must be installed on the Windows side. The MCP server (running in WSL) will invoke the Windows executable via the converted path, typically using `cmd.exe` or direct Windows path resolution through WSL's interop layer.