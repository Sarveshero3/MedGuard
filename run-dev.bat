@echo off
echo ============================================================
echo MedGuard Dev Launcher ^(Windows^)
echo ============================================================
echo.

:: Check if Docker is installed
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not in PATH.
    echo Please install Docker Desktop and try again.
    pause
    exit /b 1
)

:: Check if Docker daemon is running
docker ps >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] Docker daemon is not running.
    echo Attempting to start Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo Waiting for Docker daemon to start...
    :wait_docker
    timeout /t 5 >nul
    docker ps >nul 2>nul
    if %errorlevel% neq 0 goto wait_docker
    echo Docker daemon is ready!
)

echo.
echo [INFO] Starting MedGuard services...
docker compose up --build

echo.
echo [SUCCESS] MedGuard is running!
echo Access the application at: http://localhost
echo.
pause
