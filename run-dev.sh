#!/bin/bash
echo "============================================================"
echo "MedGuard Dev Launcher (Mac/Linux)"
echo "============================================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker is not installed or not in PATH."
    echo "Please install Docker Desktop and try again."
    exit 1
fi

# Check if Docker daemon is running
if ! docker ps &> /dev/null; then
    echo "[WARNING] Docker daemon is not running."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "Attempting to start Docker on macOS..."
        open --background -a Docker
    else
        echo "Please start the Docker service (e.g. systemctl start docker) and try again."
        exit 1
    fi

    echo "Waiting for Docker daemon to start..."
    until docker ps &> /dev/null; do
        sleep 5
    done
    echo "Docker daemon is ready!"
fi

echo ""
echo "[INFO] Starting MedGuard services..."
docker compose up --build

echo ""
echo "[SUCCESS] MedGuard is running!"
echo "Access the application at: http://localhost"
echo ""
