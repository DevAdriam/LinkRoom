import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for React frontend - allow localhost, network IPs, and production domains
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const allowedOrigins = [
    frontendUrl,
    "http://localhost:3000",
    "http://linkmeet.duckdns.org",
    "https://linkmeet.duckdns.org",
    /^http:\/\/192\.168\.\d+\.\d+:3000$/, // Allow any 192.168.x.x:3000
    /^http:\/\/10\.\d+\.\d+\.\d+:3000$/, // Allow any 10.x.x.x:3000
    /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:3000$/, // Allow 172.16-31.x.x:3000
    /^https?:\/\/.*\.duckdns\.org$/, // Allow any duckdns.org subdomain
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Check if origin matches any allowed pattern
      const isAllowed = allowedOrigins.some((allowed) => {
        if (typeof allowed === "string") {
          return origin === allowed;
        }
        return allowed.test(origin);
      });

      callback(null, isAllowed);
    },
    credentials: true,
  });

  const port = process.env.PORT || 3004;
  // Listen on all network interfaces (0.0.0.0) to allow access from other devices
  await app.listen(port, "0.0.0.0");
  console.log(`Backend server running on port ${port}`);
  console.log(`Accessible at:`);
  console.log(`  - http://localhost:${port}`);
  console.log(`  - http://127.0.0.1:${port}`);
  console.log(`  - http://<your-local-ip>:${port}`);
}
bootstrap();
