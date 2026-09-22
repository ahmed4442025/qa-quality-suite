[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$utf8 = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8
$dashboardRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $dashboardRoot
$reportRoot = Join-Path $workspaceRoot "qa_report"
$syncScript = Join-Path $PSScriptRoot "js\sync-report.cjs"

if (-not (Test-Path -LiteralPath $reportRoot -PathType Container)) {
    throw "qa_report was not found next to qa_dashboard: $reportRoot"
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
    throw "Node.js was not found. Install Node.js and try again."
}

& $nodeCommand.Source $syncScript --dashboard $dashboardRoot --report $reportRoot
if ($LASTEXITCODE -ne 0) {
    throw "Could not sync completed findings to the PM report."
}

Write-Host "Open the PM report: $reportRoot\index.html" -ForegroundColor Green
