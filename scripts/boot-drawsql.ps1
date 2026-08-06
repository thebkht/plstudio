# Start Docker Desktop if it is not already up, then bring the drawsql stack up.
# Windows counterpart of boot-drawsql.sh. Registered to run at logon by
# scripts/install-boot.ps1, but safe to run by hand — every step is a no-op when
# things are already running.
#
#   powershell -ExecutionPolicy Bypass -File scripts\boot-drawsql.ps1

$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
$log = if ($env:DRAWSQL_BOOT_LOG) { $env:DRAWSQL_BOOT_LOG } else { Join-Path $env:LOCALAPPDATA 'drawsql\boot.log' }
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $log) | Out-Null
function Write-Log($msg) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') drawsql-boot: $msg" | Out-File -Append -Encoding utf8 $log }

function Test-Docker { docker info 2>$null | Out-Null; return $LASTEXITCODE -eq 0 }

Write-Log 'starting'
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Write-Log 'docker is not installed or not on PATH'; exit 1 }

if (-not (Test-Docker)) {
  # Docker Desktop is the engine on Windows whether the backend is WSL2 or
  # Hyper-V; starting the app starts the daemon.
  $exe = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
  if (Test-Path $exe) { Start-Process -FilePath $exe -WindowStyle Hidden }
  else { Write-Log 'Docker Desktop not found at the default path; waiting for an existing daemon' }
}

# The daemon accepts connections well after its process exists, so poll instead
# of sleeping a fixed amount. ~3 minutes covers a cold WSL2 VM.
$wait = if ($env:DRAWSQL_BOOT_WAIT) { [int]$env:DRAWSQL_BOOT_WAIT } else { 90 }
for ($i = 0; $i -lt $wait -and -not (Test-Docker); $i++) { Start-Sleep -Seconds 2 }
if (-not (Test-Docker)) { Write-Log 'the docker daemon never came up'; exit 1 }

Set-Location $repo
# `--env-file` only feeds ${...} interpolation in the compose file; compose reads
# `.env` on its own, and the services carry their own `env_file:`.
$envArgs = @()
foreach ($candidate in @($env:DRAWSQL_ENV_FILE, '.env.local', '.env')) {
  if ($candidate -and (Test-Path (Join-Path $repo $candidate))) { $envArgs = @('--env-file', $candidate); break }
}

docker compose @envArgs up -d *>> $log
if ($LASTEXITCODE -eq 0) { Write-Log 'stack up' } else { Write-Log 'compose up failed'; exit 1 }
