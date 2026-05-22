# Expose local Pulse webhook receiver via ngrok (port 3001).
# Usage: powershell -ExecutionPolicy Bypass -File ./scripts/dev-tunnel.ps1
# Then:  npm run update:webhook-url -- https://YOUR-NGROK-URL

$ErrorActionPreference = 'Stop'
$Port = if ($env:PORT) { $env:PORT } else { '3001' }
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

$ngrokCandidates = @(
  (Get-Command ngrok -ErrorAction SilentlyContinue).Source,
  (Join-Path $Root '.tools\ngrok.exe'),
  "$env:LOCALAPPDATA\Microsoft\WinGet\Links\ngrok.exe"
) | Where-Object { $_ -and (Test-Path $_) }

if ($ngrokCandidates.Count -eq 0) {
  Write-Host 'ngrok not found.' -ForegroundColor Red
  Write-Host "Download to: $Root\.tools\ngrok.exe from https://ngrok.com/download"
  Write-Host 'Authenticate once: ngrok config add-authtoken YOUR_TOKEN'
  exit 1
}

$ngrok = $ngrokCandidates[0]
Write-Host "Using ngrok: $ngrok"
Write-Host "Starting ngrok tunnel to http://127.0.0.1:$Port ..."
Write-Host 'Public URL: http://127.0.0.1:4040 (inspect UI)'
Write-Host 'Update Helius webhook:'
Write-Host '  npm run update:webhook-url -- https://YOUR-SUBDOMAIN.ngrok-free.app'
Write-Host ''

& $ngrok http $Port
