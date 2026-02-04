# Docker Deployment Guide

This guide explains how to deploy the Video Call application using Docker Compose.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 2GB of free disk space

**Note:** The Dockerfiles will work with or without `package-lock.json` files. If you want more reproducible builds, generate lock files:
```bash
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
```

## Quick Start (Production) - One-Click Deploy

### Option 1: Using Start Script (Easiest)

**macOS/Linux:**
```bash
chmod +x start.sh
./start.sh
```

**Windows:**
```cmd
start.bat
```

### Option 2: Manual Start

1. **Copy environment file:**
   ```bash
   cp .env.docker .env
   ```

2. **Update environment variables** in `.env` (optional for local testing):
   ```env
   # For production, update these:
   FRONTEND_URL=http://your-domain.com
   REACT_APP_SOCKET_URL=http://your-domain.com:3004
   PUBLIC_URL=http://your-domain.com
   ANNOUNCED_IP=your.server.public.ip
   ```

3. **Build and start services:**
   ```bash
   docker-compose up -d --build
   ```

4. **Check status:**
   ```bash
   docker-compose ps
   ```

5. **View logs:**
   ```bash
   # All services
   docker-compose logs -f
   
   # Specific service
   docker-compose logs -f backend
   docker-compose logs -f frontend
   ```

6. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3004

## Development Mode

For development with hot-reload:

```bash
docker-compose -f docker-compose.dev.yml up --build
```

This will:
- Mount source code as volumes for live reload
- Run in development mode
- Enable hot-reload for both frontend and backend

## Production Deployment

### 1. Update Environment Variables

Edit `.env` file with your production settings:

```env
# Backend
BACKEND_PORT=3004
ANNOUNCED_IP=your.server.public.ip

# Frontend
FRONTEND_PORT=80
FRONTEND_URL=https://yourdomain.com
REACT_APP_SOCKET_URL=https://api.yourdomain.com
PUBLIC_URL=https://yourdomain.com
```

### 2. Build and Deploy

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Verify services are running
docker-compose ps
```

### 3. Using with Reverse Proxy (Nginx/Traefik)

If using a reverse proxy, update the frontend build args:

```yaml
frontend:
  build:
    args:
      - REACT_APP_SOCKET_URL=https://api.yourdomain.com
```

## Common Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Rebuild and restart
docker-compose up -d --build

# View logs
docker-compose logs -f

# Execute command in container
docker-compose exec backend sh
docker-compose exec frontend sh

# Restart a specific service
docker-compose restart backend
docker-compose restart frontend
```

## Troubleshooting

### Containers Not Starting / Empty `docker ps`

If containers start but immediately exit:

1. **Check container logs:**
   ```bash
   docker-compose logs backend
   docker-compose logs frontend
   ```

2. **Check all containers (including stopped):**
   ```bash
   docker-compose ps -a
   ```

3. **Common issues:**

   **Mediasoup Worker Error:**
   ```bash
   # Rebuild backend with no cache
   docker-compose build --no-cache backend
   docker-compose up -d backend
   ```

   **Port Already in Use:**
   ```bash
   # Change ports in .env
   FRONTEND_PORT=8080
   BACKEND_PORT=8084
   ```

   **Build Failures:**
   ```bash
   # Clean everything and rebuild
   docker-compose down -v
   docker-compose build --no-cache
   docker-compose up -d
   ```

### Port Already in Use

If ports 3000 or 3004 are already in use, change them in `.env`:

```env
FRONTEND_PORT=8080
BACKEND_PORT=8084
```

### Mediasoup Worker Issues

The Dockerfile automatically builds the mediasoup worker, but if you encounter errors:

```bash
# Rebuild backend
docker-compose build --no-cache backend
docker-compose up -d backend

# Check logs
docker-compose logs -f backend
```

### Network Issues

If frontend can't connect to backend:

1. Check backend is healthy:
   ```bash
   docker-compose ps backend
   ```

2. Check backend logs:
   ```bash
   docker-compose logs backend
   ```

3. Verify REACT_APP_SOCKET_URL in frontend build args matches backend service

### View Container Logs

```bash
# All logs
docker-compose logs

# Follow logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100
```

## Health Checks

Both services include health checks:

- **Backend**: HTTP check on port 3004
- **Frontend**: HTTP check on port 80

Check health status:
```bash
docker-compose ps
```

## Stopping and Cleaning Up

```bash
# Stop services
docker-compose down

# Stop and remove volumes (cleans database/cache)
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Complete cleanup (removes everything)
docker-compose down -v --rmi all --remove-orphans
```

## Production Best Practices

1. **Use HTTPS**: Set up SSL/TLS certificates (Let's Encrypt recommended)
2. **Update ANNOUNCED_IP**: Set to your server's public IP for WebRTC
3. **Resource Limits**: Add resource limits in docker-compose.yml:
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '1'
         memory: 1G
   ```
4. **Logging**: Configure log rotation
5. **Backup**: Regular backups of any persistent data
6. **Monitoring**: Set up monitoring (Prometheus, Grafana, etc.)

## Network Configuration

The services communicate via Docker network `video-call-network`. The frontend connects to backend using the service name `backend` in the Docker network.

For external access, ensure:
- Backend port (3004) is exposed
- Frontend port (3000) is exposed
- Firewall allows these ports
- ANNOUNCED_IP is set correctly for WebRTC
