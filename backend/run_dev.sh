#!/bin/bash

echo "Starting Chatify Python Backend..."

if [ -d ".venv" ]; then
    source .venv/bin/activate
elif [ -d "venv" ]; then
    source venv/bin/activate
fi

python -m uvicorn src.server:app --reload --port 3000 --host 0.0.0.0