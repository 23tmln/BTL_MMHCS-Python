@echo off
REM Script khoi dong mmhcs-python tren may CLIENT
REM Nhap IP may chu -> tu dong set bien moi truong -> chay login_ui.py

echo.
echo ╔══════════════════════════════════════╗
echo ║     MMHCS - Secure Login Client     ║
echo ╚══════════════════════════════════════╝
echo.

REM Neu co tham so dau tien thi dung lam IP, khong thi hoi user
if "%~1" neq "" (
    set SERVER_IP=%~1
    echo [+] Dung IP tu tham so: %SERVER_IP%
) else (
    set /p SERVER_IP=Nhap IP may chu (vi du: 172.17.41.222): 
)

if "%SERVER_IP%"=="" (
    echo [-] Khong co IP, thoat.
    pause
    exit /b 1
)

echo.
echo [+] Ket noi den may chu: %SERVER_IP%
echo     Backend:  http://%SERVER_IP%:3000
echo     Frontend: http://%SERVER_IP%:5173
echo.

REM Set bien moi truong -> override .env
set CHATIFY_BACKEND_URL=http://%SERVER_IP%:3000
set CHATIFY_CLIENT_URL=http://%SERVER_IP%:5173

REM Chay desktop app
cd mmhcs-python
python login_ui.py

pause
