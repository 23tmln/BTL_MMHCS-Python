@echo off
setlocal
title Chatify - Startup Manager

set "ROOT=%~dp0"

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║         CHATIFY - ALL SERVICES LAUNCHER          ║
echo  ╠══════════════════════════════════════════════════╣
echo  ║  1. Backend         (FastAPI)                    ║
echo  ║  2. Frontend        (React/Vite)                 ║
echo  ║  3. Desktop App     (Python GUI)                 ║
echo  ╚══════════════════════════════════════════════════╝
echo.

REM ─── Kiem tra thu muc ton tai ─────────────────────────────
if not exist "%ROOT%backend" (
    echo  [-] LOI: Khong tim thay thu muc backend
    pause & exit /b 1
)
if not exist "%ROOT%frontend" (
    echo  [-] LOI: Khong tim thay thu muc frontend
    pause & exit /b 1
)
if not exist "%ROOT%mmhcs-python" (
    echo  [-] LOI: Khong tim thay thu muc mmhcs-python
    pause & exit /b 1
)

echo  [+] Tat ca thu muc ton tai. Bat dau khoi dong...
echo.

REM ─── 1. Backend (Python/FastAPI) ─────────────────────────────────
echo  [1/3] Khoi dong Backend (FastAPI)...
start "Backend (Python)" /d "%ROOT%backend" cmd /k "uv run uvicorn src.server:app --host 0.0.0.0 --reload --port 3000"
echo  [+] Cua so [Backend (Python)] da mo!
echo.

echo  Cho Backend khoi dong (5 giay)...
timeout /t 5 /nobreak >nul

REM ─── 2. Frontend ──────────────────────────────────────────
echo  [2/3] Khoi dong Frontend (React)...
start "Frontend (React)" /d "%ROOT%frontend" cmd /k "npm install && npm run dev -- --host"
echo  [+] Cua so [Frontend (React)] da mo!
echo.

echo  Cho Frontend khoi dong (3 giay)...
timeout /t 3 /nobreak >nul

REM ─── 3. MMHCS Python Desktop App ─────────────────────────
echo  [3/3] Khoi dong Desktop App (mmhcs-python)...
start "MMHCS - Desktop App" /d "%ROOT%mmhcs-python" cmd /k "python login_ui.py"
echo  [+] Cua so [MMHCS - Desktop App] da mo!
echo.

REM ─── Hien thi ket qua ─────────────────────────────────────
echo  ╔══════════════════════════════════════════════════╗
echo  ║         TAT CA DICH VU DA KHOI DONG!             ║
echo  ╚══════════════════════════════════════════════════╝
echo.
echo   [1] Backend         : http://localhost:3000
echo   [2] Frontend        : http://localhost:5173
echo   [3] Desktop App     : dang chay (cua so rieng)
echo.
echo   Dong tung cua so CMD de dung dich vu tuong ung.
echo.
pause

endlocal
