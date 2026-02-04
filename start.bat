@echo off
REM Quick start script for Docker deployment (Windows)

echo Starting Video Call Application with Docker...

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo Docker is not running. Please start Docker first.
    exit /b 1
)

REM Check if .env exists, if not copy from .env.docker
if not exist .env (
    if exist .env.docker (
        echo Copying .env.docker to .env...
        copy .env.docker .env
        echo Created .env file. You can edit it if needed.
    ) else (
        echo Creating default .env file...
        (
            echo BACKEND_PORT=3004
            echo FRONTEND_PORT=3000
            echo FRONTEND_URL=http://localhost:3000
            echo REACT_APP_SOCKET_URL=http://localhost:3004
            echo PUBLIC_URL=http://localhost:3000
            echo ANNOUNCED_IP=0.0.0.0
        ) > .env
    )
)

REM Build and start services
echo Building and starting services...
docker-compose up -d --build

REM Wait a moment
timeout /t 3 /nobreak >nul

REM Check service status
echo.
echo Service Status:
docker-compose ps

echo.
echo Application started!
echo.
echo Access the application at:
echo    Frontend: http://localhost:3000
echo    Backend:  http://localhost:3004
echo.
echo View logs with: docker-compose logs -f
echo Stop with: docker-compose down
