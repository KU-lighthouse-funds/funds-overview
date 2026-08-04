# Local preview with live reload — edit files, browser updates, push when ready.
param(
    [switch]$Sync,
    [int]$Port = 8080
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if ($Sync) {
    Write-Host "Syncing programmes.json from v4.csv..." -ForegroundColor Cyan
    python sync_data.py
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host ""
}

Write-Host "Starting local dev server..." -ForegroundColor Green
Write-Host "  Landing:  http://localhost:$Port/" -ForegroundColor DarkGray
Write-Host "  Results:  http://localhost:$Port/results.html" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Edit HTML/CSS/JS in this folder — save and the page reloads." -ForegroundColor Yellow
Write-Host "When happy: git add/commit/push from funds-overview-site" -ForegroundColor Yellow
Write-Host ""

python dev_server.py --port $Port
