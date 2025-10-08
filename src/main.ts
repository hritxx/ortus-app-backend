import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";

async function bootstrap() {
  const logger = new Logger("Bootstrap");

  try {
    const app = await NestFactory.create(AppModule);

    const configService = app.get(ConfigService);
    const port = configService.get<number>("PORT", 3000);
    const apiPrefix = configService.get<string>("API_PREFIX", "api/v1");
    const corsOrigin = configService.get<string>("CORS_ORIGIN", "*");

    // Security middleware
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
          },
        },
      })
    );

    // Compression
    app.use(compression());

    // Cookie parser
    app.use(cookieParser());

    // CORS - Enhanced for mobile apps
    app.enableCors({
      origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) {
          return callback(null, true);
        }

        // Parse allowed origins from environment
        const allowedOrigins = corsOrigin.split(",").filter(Boolean);

        // Check if origin is explicitly allowed
        if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // Allow capacitor/ionic apps (mobile)
        if (
          origin.startsWith("capacitor://") ||
          origin.startsWith("ionic://") ||
          origin.startsWith("http://localhost") ||
          origin.startsWith("http://192.168.") ||
          origin.startsWith("http://10.0.")
        ) {
          return callback(null, true);
        }

        // For production, be more permissive with mobile apps
        if (process.env.NODE_ENV === "production") {
          return callback(null, true);
        }

        callback(null, true);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
        "X-Custom-Header",
      ],
      exposedHeaders: ["Content-Length", "X-Request-Id"],
      maxAge: 86400, // 24 hours
    });

    // Global prefix
    app.setGlobalPrefix(apiPrefix);

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      })
    );

    await app.listen(port, "0.0.0.0"); // Listen on all interfaces for deployment

    logger.log(
      `🚀 Application is running on: http://localhost:${port}/${apiPrefix}`
    );
    logger.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
    logger.log(`🔒 CORS Origins: ${corsOrigin}`);
  } catch (error) {
    logger.error("❌ Error during application startup", error);
    process.exit(1);
  }
}

bootstrap();
