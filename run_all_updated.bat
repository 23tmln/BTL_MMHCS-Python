@echo off
echo Starting all services...

echo Starting crypto service...
start cmd /k "cd crypto-service-backup-signal-working && npm run dev"

timeout /t 3 /nobreak > nul

echo Starting backend...
start cmd /k "cd backend && .venv\Scripts\python.exe -m uvicorn src.server:app --reload --host 0.0.0.0 --port 3000"

timeout /t 3 /nobreak > nul

echo Starting frontend...
start cmd /k "cd frontend && npm run dev"

echo All services started!