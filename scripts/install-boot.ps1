# Register (or remove) a Scheduled Task that runs scripts\boot-drawsql.ps1 at
# logon. Windows counterpart of scripts/install-boot.sh.
#
#   powershell -ExecutionPolicy Bypass -File scripts\install-boot.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\install-boot.ps1 -Uninstall
#
# The task is generated from this checkout's path, so it works from any clone.
# Run in an elevated shell with -AtStartup to start the stack before any user
# logs in; that requires the daemon to run as a service (Docker Desktop does not,
# so at-logon is the right trigger for a Desktop install).
param([switch]$Uninstall, [switch]$AtStartup)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$boot = Join-Path $repo 'scripts\boot-drawsql.ps1'
$name = 'drawsql-boot'

if (-not (Test-Path $boot)) { throw "Missing $boot" }

if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $name -Confirm:$false
}
if ($Uninstall) { Write-Host "Removed scheduled task '$name'."; return }

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$boot`"" `
  -WorkingDirectory $repo
$trigger = if ($AtStartup) { New-ScheduledTaskTrigger -AtStartup } else { New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME }
# Laptops otherwise skip the task on battery, and a cold WSL2 VM can take a
# couple of minutes to answer, so the default 3-day limit is not the constraint.
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings `
  -Description 'Start Docker Desktop and the drawsql compose stack' | Out-Null

$when = if ($AtStartup) { 'at startup' } else { "at logon for $env:USERNAME" }
Write-Host "Installed scheduled task '$name' — runs $when."
Write-Host "Log: $env:LOCALAPPDATA\drawsql\boot.log"
Write-Host "Test it now with:  Start-ScheduledTask -TaskName $name"
