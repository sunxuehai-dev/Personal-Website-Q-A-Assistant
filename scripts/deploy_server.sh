#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKIP_PULL=0

for arg in "$@"; do
  case "$arg" in
    --skip-pull)
      SKIP_PULL=1
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: ./scripts/deploy_server.sh [--skip-pull]" >&2
      exit 1
      ;;
  esac
done

cd "$PROJECT_ROOT"

if [[ ! -f ".env" ]]; then
  echo "Missing .env in $PROJECT_ROOT" >&2
  exit 1
fi

echo "Project root: $PROJECT_ROOT"

if [[ "$SKIP_PULL" -eq 0 ]]; then
  echo "Pulling latest code..."
  git pull
else
  echo "Skipping git pull."
fi

echo "Rebuilding and restarting with docker compose..."
docker compose up -d --build

echo "Container status:"
docker compose ps

echo "Health check:"
for attempt in {1..20}; do
  if curl --fail --silent http://127.0.0.1:8008/health; then
    echo
    echo "Health check passed on attempt $attempt."
    echo "Deployment completed."
    exit 0
  fi
  sleep 1
done

echo "Health check failed after multiple attempts." >&2
exit 1
