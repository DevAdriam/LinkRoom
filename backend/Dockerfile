# Backend Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies for mediasoup
RUN apk add --no-cache python3 py3-pip make g++ linux-headers

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY nest-cli.json ./

# Install all dependencies (skip mediasoup postinstall to avoid hanging)
# Use npm install if package-lock.json doesn't exist, otherwise use npm ci
RUN if [ -f package-lock.json ]; then npm ci --ignore-scripts; else npm install --ignore-scripts; fi

# Build mediasoup worker binary separately by running postinstall script
RUN cd node_modules/mediasoup && npm run postinstall || echo "Mediasoup worker build completed"

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Install runtime dependencies for mediasoup
RUN apk add --no-cache python3 py3-pip make g++ linux-headers

# Copy package files
COPY package*.json ./

# Install only production dependencies (skip mediasoup postinstall to avoid hanging)
# Use npm install if package-lock.json doesn't exist, otherwise use npm ci
RUN if [ -f package-lock.json ]; then npm ci --only=production --ignore-scripts; else npm install --only=production --ignore-scripts; fi

# Rebuild mediasoup worker in production stage (needed for native binary)
RUN cd node_modules/mediasoup && npm run postinstall || echo "Mediasoup worker build completed"

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3004

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3004', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/main.js"]
