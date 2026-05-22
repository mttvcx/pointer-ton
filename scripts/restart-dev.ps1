# Kill anything stuck on port 3001, then start Pointer (production — most reliable on Windows).
$ErrorActionPreference = 'SilentlyContinue'
Get-NetTCPConnection -LocalPort 3001 -State Listen | ForEach-Object {
  Write-Host "Stopping PID $($_.OwningProcess) on :3001"
  Stop-Process -Id $_.OwningProcess -Force
}
Start-Sleep -Seconds 1
Set-Location $PSScriptRoot\..
Write-Host "Building + starting on http://127.0.0.1:3001/pulse (this takes ~1 min first time)"
npm run dev:prod
