# ==============================================================================
# OfficNetworkManager - Remote Docker Deployment Script
# Target: root@192.168.10.7 (/opt/officnetworkmanager)
# ==============================================================================

param (
    [string]$ServerIp = "192.168.10.7",
    [string]$Username = "root",
    [string]$Password = "Admin@123"
)

$ErrorActionPreference = "Stop"

Write-Host "=== 1/4: Building Angular Production Bundle ===" -ForegroundColor Cyan
npm run build

Write-Host "=== 2/4: Packaging Deployment Files ===" -ForegroundColor Cyan
tar -czf deploy_package.tar.gz dist Dockerfile Dockerfile.build nginx.conf docker-compose.yml .dockerignore

Write-Host "=== 3/4: Uploading to $ServerIp ===" -ForegroundColor Cyan
& "C:\Program Files\PuTTY\pscp.exe" -batch -pw $Password deploy_package.tar.gz "${Username}@${ServerIp}:/opt/officnetworkmanager/deploy_package.tar.gz"

Write-Host "=== 4/4: Rebuilding & Restarting Docker Container ===" -ForegroundColor Cyan
& "C:\Program Files\PuTTY\plink.exe" -batch -pw $Password "${Username}@${ServerIp}" "cd /opt/officnetworkmanager && tar -xzf deploy_package.tar.gz && docker compose up -d --build --force-recreate"

Remove-Item -Path "deploy_package.tar.gz" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Deployment Completed Successfully!" -ForegroundColor Green
Write-Host "App accessible at:" -ForegroundColor Yellow
Write-Host "  - http://${ServerIp}/" -ForegroundColor Green
Write-Host "  - http://${ServerIp}:4200/" -ForegroundColor Green
Write-Host "  - http://${ServerIp}:8088/" -ForegroundColor Green
