#!/bin/bash

echo "🔍 Docker Diagnostic Check"
echo "=========================="
echo ""

echo "1. Checking Docker status..."
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running!"
    exit 1
fi
echo "✅ Docker is running"
echo ""

echo "2. Checking containers..."
echo "All containers (including stopped):"
docker-compose ps -a
echo ""

echo "3. Checking images..."
docker images | grep video-call || echo "No video-call images found"
echo ""

echo "4. Checking backend logs (last 20 lines)..."
docker-compose logs --tail=20 backend 2>&1 || echo "No backend logs"
echo ""

echo "5. Checking frontend logs (last 20 lines)..."
docker-compose logs --tail=20 frontend 2>&1 || echo "No frontend logs"
echo ""

echo "6. Checking if ports are in use..."
if lsof -Pi :3004 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port 3004 is already in use"
    lsof -Pi :3004 -sTCP:LISTEN
fi
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port 3000 is already in use"
    lsof -Pi :3000 -sTCP:LISTEN
fi
echo ""

echo "7. Checking .env file..."
if [ -f .env ]; then
    echo "✅ .env file exists"
    echo "Contents:"
    cat .env | grep -v "^#" | grep -v "^$"
else
    echo "❌ .env file not found"
fi
echo ""

echo "✅ Diagnostic complete!"
