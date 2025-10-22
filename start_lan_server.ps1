# start_lan_server.ps1
# Usage: run this in PowerShell from the project directory.
# It activates the venv, (optionally) creates a firewall rule and starts the Flask app.

# Activate venv
$venv = Join-Path $PSScriptRoot '.venv\Scripts\Activate.ps1'
if (Test-Path $venv) {
    Write-Host "Activating virtualenv..."
    & $venv
} else {
    Write-Host "Virtualenv activate script not found at $venv. Ensure you have a .venv folder." -ForegroundColor Yellow
}

# Offer to add firewall rule if running as admin
function Add-FirewallRuleIfNeeded {
    param(
        [int]$Port = 5000
    )
    $ruleName = "Flask 5000"
    $existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "Firewall rule '$ruleName' already exists." -ForegroundColor Green
        return
    }
    if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
        Write-Host "Not running as Administrator — skipping automatic firewall rule creation." -ForegroundColor Yellow
        Write-Host "If you need LAN access, run this script as Administrator or run the command:`nNew-NetFirewallRule -DisplayName 'Flask 5000' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5000`" -ForegroundColor Cyan
        return
    }
    try {
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -ErrorAction Stop
        Write-Host "Firewall rule '$ruleName' created." -ForegroundColor Green
    } catch {
        Write-Host "Failed to create firewall rule: $_" -ForegroundColor Red
    }
}

Add-FirewallRuleIfNeeded -Port 5000

# Run the app
Write-Host "Starting Flask app on 0.0.0.0:5000 (debug off)..."
python "${PSScriptRoot}\app.py"
