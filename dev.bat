@echo off
REM Quick startup script for Chatify development (Windows)

echo.
echo 🚀 Starting Chatify Development Environment
echo.

REM Check if uv is installed
where uv >nul 2>nul
if errorlevel 1 (
    echo ❌ ERROR: uv is not installed!
    echo 📥 Install uv from: https://docs.astral.sh/uv/getting-started/installation/
    echo    Or run: pip install uv
    pause
    exit /b 1
)

REM Check if npm is installed
where npm >nul 2>nul
if errorlevel 1 (
    echo ❌ ERROR: npm is not installed!
    echo 📥 Install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

REM Check if .env file exists in backend
if not exist "backend\.env" (
    echo ⚠️  WARNING: backend\.env not found!
    echo    Copy backend\.env.example to backend\.env and fill in your values
    echo.
    echo    Steps:
    echo    1. Copy backend\.env.example to backend\.env
    echo    2. Open backend\.env and fill in the values
    echo       - MONGO_URI: Your MongoDB connection string
    echo       - JWT_SECRET: Your secret key
    echo       - CLIENT_URL: http://localhost:5173
    echo.
    pause
    exit /b 1
)

echo ✅ All prerequisites installed!
echo.
echo Starting services in separate windows...
echo.

REM Start backend
echo 📦 Starting Backend (FastAPI) on port 3000...
start "Chatify Backend" cmd /k "cd backend && uv sync && uv run uvicorn src.server:app --reload --port 3000"

REM Give backend time to start
timeout /t 3 /nobreak

REM Start frontend
echo 🎨 Starting Frontend (React) on port 5173...
start "Chatify Frontend" cmd /k "cd frontend && npm install && npm run dev"

echo.
echo ════════════════════════════════════════
echo ✨ Chatify is now running! ✨
echo ════════════════════════════════════════
echo.
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:5173
echo.
echo Services are running in separate windows.
echo Close the windows to stop the services.
echo.
pause
