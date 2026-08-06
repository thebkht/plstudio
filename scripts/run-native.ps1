# Run the app on Windows without Docker: the Next server and the collaboration
# server as two plain Node processes.
#
#   powershell -ExecutionPolicy Bypass -File scripts\run-native.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\run-native.ps1 -Stop
#
# Assumes `pnpm install`, `pnpm drizzle-kit push` and `pnpm build` have been run
# once — see the "Running without Docker" section of the README.
param([switch]$Stop)

$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $env:LOCALAPPDATA 'drawsql'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$pidFile = Join-Path $logDir 'native.pids'
function Write-Log($msg) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') drawsql-native: $msg" | Tee-Object -Append (Join-Path $logDir 'native.log') }

if ($Stop) {
  if (Test-Path $pidFile) {
    Get-Content $pidFile | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
    Remove-Item $pidFile
    Write-Log 'stopped'
  } else { Write-Log 'nothing to stop' }
  return
}

# Docker hands these to the containers through `env_file:`; nothing does that for
# a bare `pnpm collab`, which reads COLLAB_TOKEN_SECRET straight off the
# environment. Next loads .env.local itself, but setting them here covers both.
$envFile = Join-Path $repo '.env.local'
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
      $value = $matches[2].Trim().Trim('"').Trim("'")
      [Environment]::SetEnvironmentVariable($matches[1], $value, 'Process')
    }
  }
} else { Write-Log "no .env.local found at $envFile — the servers will likely refuse to start" }

if (-not $env:DATA_DIR) { $env:DATA_DIR = Join-Path $repo 'data' }
New-Item -ItemType Directory -Force -Path $env:DATA_DIR | Out-Null

$procs = @()
foreach ($svc in @(@{name='web'; args='start'}, @{name='collab'; args='collab'})) {
  $p = Start-Process -FilePath 'pnpm' -ArgumentList $svc.args -WorkingDirectory $repo -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $logDir "$($svc.name).log") -RedirectStandardError (Join-Path $logDir "$($svc.name).err.log")
  $procs += $p.Id
  Write-Log "started $($svc.name) (pid $($p.Id))"
}
$procs | Set-Content $pidFile
Write-Log "app on http://localhost:3000 — logs in $logDir"
