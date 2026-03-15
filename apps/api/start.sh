#!/bin/bash
# Production startup script for VeryFastChat API

set -e

# Default values
WORKERS=${WORKERS:-4}
PORT=${PORT:-8000}
HOST=${HOST:-0.0.0.0}
TIMEOUT=${TIMEOUT:-30}

echo "Starting VeryFastChat API..."
echo "Environment: ${API_ENV:-development}"
echo "Workers: $WORKERS"
echo "Port: $PORT"

# Start uvicorn with production settings
exec uvicorn app.main:app \
  --host "$HOST" \
  --port "$PORT" \
  --workers "$WORKERS" \
  --timeout-keep-alive "$TIMEOUT" \
  --log-level info \
  --access-log \
  --no-use-colors
