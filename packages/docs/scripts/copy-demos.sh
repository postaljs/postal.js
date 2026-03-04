#!/usr/bin/env bash
# copy-demos.sh
#
# Builds the postal library packages and example apps, then copies the built
# demo output into the docs dist directory so they're served alongside the
# docs at /demos/<name>/.
#
# Run from the repo root. Requires pnpm.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

echo "Building postal core..."
pnpm --filter postal build

echo "Building postal-transport-messageport..."
pnpm --filter postal-transport-messageport build

echo "Building notification-dashboard example..."
VITE_BASE_PATH="/demos/notification-dashboard/" pnpm --filter @postal-examples/notification-dashboard build

echo "Copying notification-dashboard demo to docs dist..."
DEST="$REPO_ROOT/packages/docs/dist/demos/notification-dashboard"
mkdir -p "$DEST"
cp -r "$REPO_ROOT/examples/notification-dashboard/dist/"* "$DEST/"

echo "Building gif-stitch example..."
VITE_BASE_PATH="/demos/gif-stitch/" pnpm --filter @postal-examples/gif-stitch build

echo "Copying gif-stitch demo to docs dist..."
DEST="$REPO_ROOT/packages/docs/dist/demos/gif-stitch"
mkdir -p "$DEST"
cp -r "$REPO_ROOT/examples/gif-stitch/dist/"* "$DEST/"

echo "Building postal-transport-broadcastchannel..."
pnpm --filter postal-transport-broadcastchannel build

echo "Building tab-sync example..."
VITE_BASE_PATH="/demos/tab-sync/" pnpm --filter @postal-examples/tab-sync build

echo "Copying tab-sync demo to docs dist..."
DEST="$REPO_ROOT/packages/docs/dist/demos/tab-sync"
mkdir -p "$DEST"
cp -r "$REPO_ROOT/examples/tab-sync/dist/"* "$DEST/"

echo "Demos copied successfully."
