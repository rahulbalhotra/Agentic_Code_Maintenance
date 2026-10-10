@echo off
setlocal enabledelayedexpansion

title Auto Jira Agent - All Services
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

:: 2. Check Python Virtual Environment
if not exist "agent_backend\.venv\Scripts\python.exe" (
    echo [WARNING] Python virtual environment not found at agent_backend\.venv
    echo Creating virtual environment...
    python -m venv agent_backend\.venv
    if exist "agent_backend\requirements.txt" (
        echo Installing agent backend requirements...
        agent_backend\.venv\Scripts\python.exe -m pip install -r agent_backend\requirements.txt
    )
)

:: 3. Check dependencies
if not exist "node_modules\concurrently" (
    echo [INFO] Installing root dependencies...
    call npm install
)

if not exist "server\node_modules" (
    echo [INFO] Installing server dependencies...
    call npm --prefix server install
)

if not exist "client\node_modules" (
    echo [INFO] Installing client dependencies...
    call npm --prefix client install
)

:: Check for separate window mode (--split or -s)
if "%1"=="--split" goto split_mode
if "%1"=="-s" goto split_mode

echo Starting all services in unified console:
echo   [1] Express API Server:   http://localhost:4000
echo   [2] Vite React UI:        http://localhost:5173
echo   [3] Python Agent Backend: http://localhost:8000
echo.
echo Opening browser in 4 seconds...
echo Press Ctrl+C to stop all services.
echo ========================================================
echo.

:: Open default browser after brief startup delay
start /b "" cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:5173"

:: Run all services concurrently
call npm run dev
goto end

:split_mode
echo Launching services in separate terminal windows...
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
