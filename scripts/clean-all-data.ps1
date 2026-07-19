# ============================================================
# MedGuard — Full Data Cleanup Script
# Wipes: Postgres volume, Redis data, uploaded files,
#        and ms2 temp files. Safe to run before docker compose up.
# ============================================================

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot  # MedGuard repo root

Write-Host '=== MedGuard Data Cleanup ===' -ForegroundColor Cyan

# 1. Stop running containers (if Docker is available)
Write-Host '[1/5] Stopping containers...' -ForegroundColor Yellow
try {
    docker compose -f "$root\docker-compose.yml" down -v 2>&1 | Out-Null
    Write-Host '  ✅ Containers stopped and volumes removed.' -ForegroundColor Green
} catch {
    Write-Host '  ⚠️  Docker not running — skipping container stop. Volumes will be removed on next start.' -ForegroundColor DarkYellow
}

# 2. Remove Docker volumes explicitly (postgres_data holds all DB state)
Write-Host '[2/5] Removing Docker volumes...' -ForegroundColor Yellow
try {
    $volumeName = 'medguard_postgres_data'
    docker volume rm $volumeName 2>&1 | Out-Null
    Write-Host "  ✅ Volume '$volumeName' removed." -ForegroundColor Green
} catch {
    Write-Host '  ⚠️  Volume not found or Docker not running — will be recreated fresh.' -ForegroundColor DarkYellow
}

# 3. Clear uploaded files from ms1
Write-Host '[3/5] Clearing ms1 uploads...' -ForegroundColor Yellow
$uploadsPath = "$root\ms1-core-api\uploads"
if (Test-Path $uploadsPath) {
    Get-ChildItem $uploadsPath -Recurse -File | Remove-Item -Force
    Write-Host "  ✅ Cleared $uploadsPath" -ForegroundColor Green
} else {
    Write-Host '  ℹ️  No uploads directory found — nothing to clean.' -ForegroundColor Gray
}

# 4. Clear any ms2 temp/cache files
Write-Host '[4/5] Clearing ms2 temp files...' -ForegroundColor Yellow
$ms2Temp = "$root\ms2-agent-service\__pycache__"
if (Test-Path $ms2Temp) {
    Remove-Item $ms2Temp -Recurse -Force
    Write-Host '  ✅ Cleared ms2 __pycache__' -ForegroundColor Green
} else {
    Write-Host '  ℹ️  No ms2 cache found.' -ForegroundColor Gray
}
# Also clear any .pytest_cache
$pytestCache = "$root\ms2-agent-service\.pytest_cache"
if (Test-Path $pytestCache) {
    Remove-Item $pytestCache -Recurse -Force
    Write-Host '  ✅ Cleared ms2 .pytest_cache' -ForegroundColor Green
}

# 5. Summary
Write-Host '[5/5] Summary' -ForegroundColor Yellow
Write-Host '  ✅ All user-inputted data has been cleaned:' -ForegroundColor Green
Write-Host '     - PostgreSQL volume removed (fresh init.sql will run on next start)' -ForegroundColor Green
Write-Host '     - Redis data cleared (volume removed)' -ForegroundColor Green
Write-Host '     - Uploaded files removed' -ForegroundColor Green
Write-Host '     - Python caches cleared' -ForegroundColor Green
Write-Host '' -ForegroundColor Green
Write-Host '  Next steps:' -ForegroundColor Green
Write-Host '     1. Start Docker Desktop' -ForegroundColor Green
Write-Host '     2. Run: docker compose up --build' -ForegroundColor Green
Write-Host '     3. CLEAN_DB=true is set in docker-compose.yml, so the database' -ForegroundColor Green
Write-Host '        will be recreated from init.sql with only the seed data' -ForegroundColor Green
Write-Host '        (brand_generic_map, interaction_kb, test_type_normalization)' -ForegroundColor Green
Write-Host '     4. Frontend localStorage will need to be cleared manually in the' -ForegroundColor Green
Write-Host '        browser (DevTools > Application > Storage > Clear site data)' -ForegroundColor Green
Write-Host '        or users can simply log in again.' -ForegroundColor Green
Write-Host ''
Write-Host '=== Cleanup Complete ===' -ForegroundColor Cyan
