#!/bin/bash

# Script to rebuild mediasoup worker binary
# This is needed when using pnpm or if the worker binary is missing

echo "Rebuilding mediasoup worker binary..."

# Try to find mediasoup installation
if [ -d "node_modules/mediasoup" ]; then
    cd node_modules/mediasoup
    npm run build:worker
    cd ../..
    echo "Mediasoup worker rebuilt successfully!"
elif [ -d "node_modules/.pnpm" ]; then
    # For pnpm
    MEDIASOUP_PATH=$(find node_modules/.pnpm -path "*/mediasoup/package.json" | head -1 | xargs dirname)
    if [ -n "$MEDIASOUP_PATH" ]; then
        cd "$MEDIASOUP_PATH"
        npm run build:worker
        cd - > /dev/null
        echo "Mediasoup worker rebuilt successfully!"
    else
        echo "Could not find mediasoup installation. Please reinstall dependencies."
        exit 1
    fi
else
    echo "Could not find mediasoup installation. Please run 'npm install' first."
    exit 1
fi
