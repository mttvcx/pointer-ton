# Hard reset local dev: kill :3001, wipe Next cache, start Turbopack on 127.0.0.1
$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path $PSScriptRoot -Parent

Write-Host '== Pointer dev reset ==' -ForegroundColor Cyan

Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Host "Killing PID $($_.OwningProcess) on :3001"
  Stop-Process -Id $_.OwningProcess -Force
}

$nextDir = Join-Path $root '.next'
if (Test-Path $nextDir) {
  Write-Host 'Removing .next cache...'
  Remove-Item -Recurse -Force $nextDir
}

Start-Sleep -Seconds 1

Write-Host 'Starting Turbopack dev at http://127.0.0.1:3001/pulse' -ForegroundColor Green
Write-Host 'Use 127.0.0.1 in the browser — not localhost (avoids DNS lag on Windows).' -ForegroundColor Yellow

Start-Process powershell -WorkingDirectory $root -ArgumentList '-NoExit', '-Command', 'npm run dev'
