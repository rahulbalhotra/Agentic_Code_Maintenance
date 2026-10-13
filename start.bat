@echo off
setlocal enabledelayedexpansion

title Auto Jira Agent - Autonomous Multi-Agent System
cd /d "%~dp0"

echo ========================================================
echo   Auto Jira Agent - Autonomous Multi-Agent System
echo ========================================================
echo.

:: 1. Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found in PATH!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: 2. Check if setup is needed
if not exist "node_modules" (
    echo [INFO] Running initial cross-platform setup...
    call node scripts/setup.js
) else if not exist "server\node_modules" (
    echo [INFO] Installing server dependencies...
    call node scripts/setup.js
) else if not exist "client\node_modules" (
    echo [INFO] Installing client dependencies...
    call node scripts/setup.js
) else if not exist "agent_backend\.venv" (
    echo [INFO] Setting up Python virtual environment...
    call node scripts/setup.js
)

:: Check for separate window mode (--split or -s)
if "%1"=="--split" goto split_mode
if "%1"=="-s" goto split_mode

echo Starting all services with distinct port assignments:
echo   [1] Vite React UI:        http://localhost:5173
echo   [2] Express API Server:   http://localhost:4000
echo   [3] Python Agent Backend: http://localhost:8000
echo   [4] Neo4j Graph Database: bolt://localhost:7687
echo.
echo Opening browser in 3 seconds...
echo Press Ctrl+C to stop all services.
echo ========================================================
echo.

:: Open default browser after brief startup delay
start /b "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173"

:: Run all services concurrently via cross-platform runners
call npm run dev
goto end

:split_mode
echo Launching services in separate terminal windows with dedicated ports...
start "Express API Server (Port 4000)" cmd /k "cd /d \"%~dp0\" && npm run server"
start "Vite React UI (Port 5173)" cmd /k "cd /d \"%~dp0\" && npm run client"
start "Python Agent Backend (Port 8000)" cmd /k "cd /d \"%~dp0\" && npm run agent"

echo Services launched! Opening browser...
timeout /t 3 /nobreak >nul
start http://localhost:5173
goto end

:end
if %ERRORLEVEL% neq 0 (
    echo.
    echo [INFO] Process exited.
    pause
)
