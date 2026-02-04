# Environment Variables Setup

Create `.env` files in both `backend/` and `frontend/` directories with the following content:

## Backend `.env` file

Create `backend/.env`:

```env
# Backend Environment Variables

# Server Port
PORT=3004

# Frontend URL for CORS
FRONTEND_URL=http://localhost:3000

# Mediasoup Configuration
# Set this to your server's public IP address for production
# For local development, use 127.0.0.1
ANNOUNCED_IP=127.0.0.1

# Node Environment
NODE_ENV=development
```

## Frontend `.env` file

Create `frontend/.env`:

```env
# Frontend Environment Variables

# Backend Socket.io URL
REACT_APP_SOCKET_URL=http://localhost:3004

# Public URL (used for service worker)
PUBLIC_URL=

# Node Environment
NODE_ENV=development
```

## Production Configuration

For production deployment, update these values:

### Backend `.env` (Production)

```env
PORT=3004
FRONTEND_URL=https://yourdomain.com
ANNOUNCED_IP=your.server.public.ip
NODE_ENV=production
```

### Frontend `.env` (Production)

```env
REACT_APP_SOCKET_URL=https://api.yourdomain.com
PUBLIC_URL=https://yourdomain.com
NODE_ENV=production
```

## Important Notes

1. **ANNOUNCED_IP**: This is critical for WebRTC. In production, set it to your server's public IP address or domain.
2. **CORS**: The backend now automatically allows network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x) for local development.
3. **HTTPS**: For production, use HTTPS as WebRTC requires secure contexts.
4. **Port**: Change ports if needed, but make sure frontend and backend match.
5. **Network Access**: The backend now listens on `0.0.0.0` (all interfaces) so it's accessible from other devices on your network.

## Accessing from Mobile/Other Devices

The app automatically detects if you're accessing it via:

- **localhost/127.0.0.1**: Uses `http://localhost:3004` for backend
- **Network IP** (e.g., 192.168.100.61): Uses `http://<same-ip>:3004` for backend

### Steps to Access from Phone:

1. **Find your computer's local IP address:**

   ```bash
   # macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1

   # Windows
   ipconfig
   ```

2. **Start the backend** (it will listen on all interfaces):

   ```bash
   cd backend
   npm run start:dev
   ```

3. **Start the frontend** (accessible from network):

   ```bash
   cd frontend
   # macOS/Linux
   npm run start:network

   # Or set HOST in .env file:
   # HOST=0.0.0.0
   # Then just: npm start

   # Windows (use Git Bash or WSL, or set in .env)
   # Add to frontend/.env: HOST=0.0.0.0
   ```

4. **Access from phone:**
   - Open browser on phone
   - Go to: `http://<your-computer-ip>:3000`
   - Example: `http://192.168.100.61:3000`

The frontend will automatically connect to `http://<your-computer-ip>:3004` for the backend.

## Quick Setup Commands

```bash
# Backend
cd backend
cat > .env << EOF
PORT=3004
FRONTEND_URL=http://localhost:3000
ANNOUNCED_IP=127.0.0.1
NODE_ENV=development
EOF

# Frontend
cd ../frontend
cat > .env << EOF
REACT_APP_SOCKET_URL=http://localhost:3004
PUBLIC_URL=
NODE_ENV=development
EOF
```
