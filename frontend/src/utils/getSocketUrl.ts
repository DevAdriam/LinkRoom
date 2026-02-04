/**
 * Get the Socket.io URL based on the current hostname
 * Automatically detects if we're on localhost or network IP
 * Also handles Docker environments
 */
export function getSocketUrl(): string {
  // Use environment variable if set (highest priority)
  if (process.env.REACT_APP_SOCKET_URL) {
    // In Docker, replace 'backend' service name with actual hostname for client-side
    const socketUrl = process.env.REACT_APP_SOCKET_URL;
    if (socketUrl.includes('backend:3004')) {
      // Client-side can't use Docker service names, use current hostname
      const hostname = window.location.hostname;
      const protocol = window.location.protocol;
      const port = window.location.port || (protocol === 'https:' ? '443' : '80');
      // If frontend is on port 80/443, backend is on 3004
      // If frontend is on custom port, assume backend is on same host, port 3004
      return `${protocol}//${hostname}:3004`;
    }
    return socketUrl;
  }

  // Get current hostname and port
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // If accessing via localhost or 127.0.0.1, use localhost for backend
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3004';
  }
  
  // If accessing via network IP, use the same IP for backend
  // Replace port 3000 with 3004
  const port = window.location.port || (protocol === 'https:' ? '443' : '80');
  const backendPort = '3004';
  
  return `${protocol}//${hostname}:${backendPort}`;
}
