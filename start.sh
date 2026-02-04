#!/bin/bash

# Quick start script for Docker deployment

echo "🚀 Starting Video Call Application with Docker..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if .env exists, if not copy from .env.docker
if [ ! -f .env ]; then
    if [ -f .env.docker ]; then
        echo "📋 Copying .env.docker to .env..."
        cp .env.docker .env
        echo "✅ Created .env file. You can edit it if needed."
    else
        echo "⚠️  No .env file found. Creating default .env..."
        cat > .env << EOF
BACKEND_PORT=3004
FRONTEND_PORT=3000
FRONTEND_URL=http://localhost:3000
REACT_APP_SOCKET_URL=http://localhost:3004
PUBLIC_URL=http://localhost:3000
ANNOUNCED_IP=0.0.0.0
EOF
    fi
fi

# Build and start services
echo "🔨 Building and starting services..."
echo "   This may take a few minutes on first run (building mediasoup worker)..."
docker-compose up -d --build

# Wait a moment for services to start
echo "⏳ Waiting for services to start..."
sleep 5

# Check service status
echo ""
echo "📊 Service Status:"
docker-compose ps

# Check if containers are running
if ! docker-compose ps | grep -q "Up"; then
    echo ""
    echo "⚠️  Some containers may have failed to start. Checking logs..."
    echo ""
    docker-compose logs --tail=30
    echo ""
    echo "💡 Try running: docker-compose logs -f backend"
fi

echo ""
echo "✅ Application started!"
echo ""
echo "🌐 Access the application at:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3004"
echo ""
echo "📝 View logs with: docker-compose logs -f"
echo "🛑 Stop with: docker-compose down"
