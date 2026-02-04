# Video Call Application

A real-time video calling application built with React.js, NestJS, Socket.io, and Mediasoup.

## Features

- Create video call rooms
- Share room links with others
- Join rooms via link or room ID
- Real-time video and audio communication
- Mobile-responsive PWA (Progressive Web App)
- Toggle video/audio controls

## Tech Stack

### Frontend
- React.js with TypeScript
- Tailwind CSS (mobile-first responsive design)
- Socket.io Client
- Mediasoup Client
- React Router

### Backend
- NestJS with TypeScript
- Socket.io
- Mediasoup
- WebRTC

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

**Important:** If you encounter a "mediasoup-worker ENOENT" error, the mediasoup native worker binary needs to be rebuilt. Run:

```bash
npm run rebuild:mediasoup
```

Or manually:
```bash
# Find and rebuild mediasoup worker
./rebuild-mediasoup.sh

# Or if using pnpm, find the mediasoup path and rebuild:
find node_modules -path "*/mediasoup/package.json" -exec sh -c 'cd "$(dirname {})" && npm run build:worker' \;
```

3. Create a `.env` file (optional, defaults are provided):
```env
PORT=3001
FRONTEND_URL=http://localhost:3000
ANNOUNCED_IP=127.0.0.1
```

4. Start the development server:
```bash
npm run start:dev
```

The backend will run on `http://localhost:3001`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file (optional):
```env
REACT_APP_SOCKET_URL=http://localhost:3001
```

4. Start the development server:
```bash
npm start
```

The frontend will run on `http://localhost:3000`

## Usage

1. Open the application in your browser
2. Click "Create Room" to create a new video call room
3. Share the room link with others
4. Others can join by clicking the link or entering the room ID
5. Grant camera and microphone permissions when prompted
6. Start video calling!

## Mobile/PWA

The application is optimized for mobile devices and can be installed as a Progressive Web App (PWA). On mobile devices, you can add it to your home screen for a native app-like experience.

## Production Deployment

### Option 1: Docker Compose (Recommended - One-Click Deploy)

The easiest way to deploy:

```bash
# 1. Copy environment file
cp .env.docker .env

# 2. Edit .env with your production settings (optional)
# FRONTEND_URL=https://yourdomain.com
# REACT_APP_SOCKET_URL=https://api.yourdomain.com
# ANNOUNCED_IP=your.server.public.ip

# 3. Build and start
docker-compose up -d --build

# 4. Access the app
# Frontend: http://localhost:3000
# Backend: http://localhost:3004
```

See [DOCKER.md](./DOCKER.md) for detailed Docker deployment guide.

### Option 2: Manual Deployment

#### Backend
1. Build the application:
```bash
npm run build
```

2. Start in production mode:
```bash
npm run start:prod
```

#### Frontend
1. Build the application:
```bash
npm run build
```

2. Serve the `build` folder using a static file server (e.g., nginx, serve)

## Notes

- Make sure to configure proper STUN/TURN servers for production deployment
- Update `ANNOUNCED_IP` in backend `.env` with your server's public IP address
- For production, use HTTPS as WebRTC requires secure contexts
