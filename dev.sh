#!/bin/bash
# Quick startup script for Chatify development

echo "🚀 Starting Chatify Development Environment"
echo ""

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "❌ ERROR: uv is not installed!"
    echo "📥 Install uv from: https://docs.astral.sh/uv/getting-started/installation/"
    echo "   Or run: pip install uv"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ ERROR: npm is not installed!"
    echo "📥 Install Node.js from: https://nodejs.org/"
    exit 1
fi

# Check if .env file exists in backend
if [ ! -f "backend/.env" ]; then
    echo "⚠️  WARNING: backend/.env not found!"
    echo "   Copy backend/.env.example to backend/.env and fill in your values"
    echo ""
    echo "   Example:"
    echo "   cp backend/.env.example backend/.env"
    echo "   nano backend/.env"
    echo ""
    exit 1
fi

echo "✅ All prerequisites installed!"
echo ""
echo "Starting services..."
echo ""

# Start backend in background
echo "📦 Starting Backend (FastAPI)..."
cd backend
uv sync > /dev/null 2>&1
uv run uvicorn src.server:app --reload --port 3000 &
BACKEND_PID=$!
cd ..

# Give backend time to start
sleep 2

# Start frontend in background
echo "🎨 Starting Frontend (React)..."
cd frontend
npm install > /dev/null 2>&1
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "════════════════════════════════════════"
echo "✨ Chatify is now running! ✨"
echo "════════════════════════════════════════"
echo ""
echo "Backend:  http://localhost:3000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for either process to exit
wait -n
EXITED_PID=$!

# Kill remaining processes
if [ $EXITED_PID -eq $BACKEND_PID ]; then
    echo "Backend stopped. Closing frontend..."
    kill $FRONTEND_PID 2>/dev/null
else
    echo "Frontend stopped. Closing backend..."
    kill $BACKEND_PID 2>/dev/null
fi

exit 0
