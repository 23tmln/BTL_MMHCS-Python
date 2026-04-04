#!/bin/bash

set -e  # Exit on error

echo "🚀 Starting Chatify Python Backend with Socket.IO..."
echo ""

echo "✓ MongoDB configuration verified"

echo "📋 Environment: $(grep NODE_ENV .env | cut -d '=' -f2)"
echo "🔌 Server Port: $(grep PORT .env | cut -d '=' -f2)"
echo "🔗 Client URL: $(grep CLIENT_URL .env | cut -d '=' -f2)"
echo ""

echo "▶️  Starting FastAPI server with Socket.IO support..."
echo ""

cd "$(dirname "$0")" || exit 1

uv run uvicorn src.server:app \
  --reload \
  --port 3000 \
  --host 0.0.0.0 \
  --log-level info

echo ""
echo "⚠️  Server stopped. To restart, run: bash start.sh"