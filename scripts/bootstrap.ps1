# ─────────────────────────────────────────────────────────────
# MedGuard Bootstrap Script (PowerShell)
# Run from the MedGuard root directory.
# Starts Docker Desktop, waits for the daemon, brings up all
# containers, and reloads Nginx config.
# ─────────────────────────────────────────────────────────────

param(
    [switch]$Build,         # Pass -Build to force rebuild images
    [int]$TimeoutSec = 120  # Max seconds to wait for Docker daemon
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot | Split-Path -Parent

Write-Host "`n🚀 MedGuard Bootstrap" -ForegroundColor Cyan
Write-Host "   Root: $root`n"

# ── 1. Ensure Docker Desktop is running ──────────────────────
function Wait-ForDocker {
    $elapsed = 0
    while ($elapsed -lt $TimeoutSec) {
        try {
            $out = docker info 2>&1
            if ($LASTEXITCODE -eq 0) { return $true }
        } catch {}
        Start-Sleep -Seconds 3
        $elapsed += 3
        Write-Host "   ⏳ Waiting for Docker daemon... ($elapsed s)" -ForegroundColor DarkGray
    }
    return $false
}

$dockerRunning = $false
try {
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $dockerRunning = $true }
} catch {}

if (-not $dockerRunning) {
    Write-Host "📦 Docker not running. Launching Docker Desktop..." -ForegroundColor Yellow

    # Try the Desktop shortcut first (user-specific), then Program Files
    $shortcut = "$env:USERPROFILE\Desktop\Docker Desktop.lnk"
    if (Test-Path $shortcut) {
        Start-Process $shortcut
    } else {
        $exe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
        if (Test-Path $exe) {
            Start-Process $exe
        } else {
            Write-Error "Cannot find Docker Desktop. Please start it manually."
            exit 1
        }
    }

    Write-Host "   Waiting for Docker daemon to be ready (timeout ${TimeoutSec}s)..."
    if (-not (Wait-ForDocker)) {
        Write-Error "Docker daemon did not start within ${TimeoutSec}s. Aborting."
        exit 1
    }
}

Write-Host "✅ Docker daemon is ready.`n" -ForegroundColor Green

# ── 2. Bring up all containers ───────────────────────────────
Push-Location $root
try {
    if ($Build) {
        Write-Host "🔨 Building and starting all containers..." -ForegroundColor Cyan
        docker compose up -d --build
    } else {
        Write-Host "🔄 Starting all containers..." -ForegroundColor Cyan
        docker compose up -d
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Error "docker compose up failed."
        exit 1
    }

    Write-Host "`n✅ Containers started." -ForegroundColor Green

    # ── 3. Wait for healthy services ─────────────────────────
    Write-Host "`n⏳ Waiting for services to become healthy..." -ForegroundColor Cyan

    $services = @("medguard-postgres-1", "medguard-ms1-core-api-1", "medguard-ms2-agent-service-1")
    foreach ($svc in $services) {
        $attempts = 0
        $maxAttempts = 40  # 40 × 3s = 120s
        while ($attempts -lt $maxAttempts) {
            $health = docker inspect --format='{{.State.Health.Status}}' $svc 2>&1
            if ($health -eq "healthy") {
                Write-Host "   ✅ $svc is healthy" -ForegroundColor Green
                break
            }
            $attempts++
            Start-Sleep -Seconds 3
        }
        if ($attempts -ge $maxAttempts) {
            Write-Host "   ⚠️  $svc did not become healthy in time" -ForegroundColor Yellow
        }
    }

    # ── 4. Reload Nginx config ───────────────────────────────
    Write-Host "`n🔄 Reloading Nginx configuration..." -ForegroundColor Cyan
    docker exec medguard-nginx-1 nginx -s reload 2>&1 | Out-Null
    Write-Host "   ✅ Nginx reloaded." -ForegroundColor Green

    # ── 5. Print status ──────────────────────────────────────
    Write-Host "`n📋 Container Status:" -ForegroundColor Cyan
    docker compose ps

    Write-Host "`n🎉 MedGuard is ready at http://localhost`n" -ForegroundColor Green

} finally {
    Pop-Location
}
