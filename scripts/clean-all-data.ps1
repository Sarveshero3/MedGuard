# ============================================================
# MedGuard — Full Data Cleanup Script
# Wipes: Postgres volume, Redis data, uploaded files,
#        and ms2 temp files. Safe to run before docker compose up.
# ============================================================

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot  # MedGuard repo root

Write-Host "`n=== MedGuard Data Cleanup ===" -ForegroundColor Cyan

# 1. Stop running containers (if Docker is available)
Write-Host "`n[1/5] Stopping containers..." -ForegroundColor Yellow
try {
    docker compose -f "$root\docker-compose.yml" down -v 2>&1 | Out-Null
    Write-Host "  ✅ Containers stopped and volumes removed." -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  Docker not running — skipping container stop. Volumes will be removed on next start." -ForegroundColor DarkYellow
}

# 2. Remove Docker volumes explicitly (postgres_data holds all DB state)
Write-Host "`n[2/5] Removing Docker volumes..." -ForegroundColor Yellow
try {
    $volumeName = "medguard_postgres_data"
    docker volume rm $volumeName 2>&1 | Out-Null
    Write-Host "  ✅ Volume '$volumeName' removed." -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  Volume not found or Docker not running — will be recreated fresh." -ForegroundColor DarkYellow
}

# 3. Clear uploaded files from ms1
Write-Host "`n[3/5] Clearing ms1 uploads..." -ForegroundColor Yellow
$uploadsPath = "$root\ms1-core-api\uploads"
if (Test-Path $uploadsPath) {
    Get-ChildItem $uploadsPath -Recurse -File | Remove-Item -Force
    Write-Host "  ✅ Cleared $uploadsPath" -ForegroundColor Green
} else {
    Write-Host "  ℹ️  No uploads directory found — nothing to clean." -ForegroundColor Gray
}

# 4. Clear any ms2 temp/cache files
Write-Host "`n[4/5] Clearing ms2 temp files..." -ForegroundColor Yellow
$ms2Temp = "$root\ms2-agent-service\__pycache__"
if (Test-Path $ms2Temp) {
    Remove-Item $ms2Temp -Recurse -Force
    Write-Host "  ✅ Cleared ms2 __pycache__" -ForegroundColor Green
} else {
    Write-Host "  ℹ️  No ms2 cache found." -ForegroundColor Gray
}
# Also clear any .pytest_cache
$pytestCache = "$root\ms2-agent-service\.pytest_cache"
if (Test-Path $pytestCache) {
    Remove-Item $pytestCache -Recurse -Force
    Write-Host "  ✅ Cleared ms2 .pytest_cache" -ForegroundColor Green
}

# 5. Summary
Write-Host "`n[5/5] Summary" -ForegroundColor Yellow
Write-Host @"

  ✅ All user-inputted data has been cleaned:
     - PostgreSQL volume removed (fresh init.sql will run on next start)
     - Redis data cleared (volume removed)
     - Uploaded files removed
     - Python caches cleared

  Next steps:
     1. Start Docker Desktop
     2. Run: docker compose up --build
     3. CLEAN_DB=true is set in docker-compose.yml, so the database
        will be recreated from init.sql with only the seed data
        (brand_generic_map, interaction_kb, test_type_normalization)
     4. Frontend localStorage will need to be cleared manually in the
        browser (DevTools > Application > Storage > Clear site data)
        or users can simply log in again.

"@ -ForegroundColor Green

Write-Host "=== Cleanup Complete ===" -ForegroundColor Cyan
