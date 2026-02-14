import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { LoggerService } from './common/logger/logger.service';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { CacheInterceptor } from './common/interceptors/cache.interceptor';
import { SanitizationMiddleware } from './common/middleware/security.middleware';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import {
  initializeNewRelic,
  createNewRelicMiddleware,
} from './newrelic.initialization';

async function bootstrap() {
  // ========================================
  // NEW RELIC INITIALIZATION (MUST BE FIRST)
  // ========================================
  initializeNewRelic();

  // Create logger first
  const logger = new LoggerService('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Enable raw body for Stripe webhooks
    logger: logger, // Use custom logger
  });

  const configService = app.get(ConfigService);

  // ========================================
  // NEW RELIC MIDDLEWARE
  // ========================================
  if (configService.get<boolean>('NEW_RELIC_ENABLED', false)) {
    app.use(createNewRelicMiddleware());
  }

  // ========================================
  // SECURITY MIDDLEWARE
  // ========================================

  // Helmet - Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", 'https://api.openai.com', 'wss:'],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  // Request sanitization
  app.use(new SanitizationMiddleware().use.bind(new SanitizationMiddleware()));

  // Cookie parser (required for CSRF)
  app.use(cookieParser());

  // CSRF protection
  if (configService.get<boolean>('CSRF_ENABLED', true)) {
    app.use(new CsrfMiddleware().use.bind(new CsrfMiddleware()));
    logger.log('🛡️  CSRF protection enabled');
  }

  // Compression
  app.use(compression());

  // ========================================
  // CORS CONFIGURATION
  // ========================================

  const frontendUrl = configService.get<string>('FRONTEND_URL');
  const allowedOrigins = frontendUrl
    ? frontendUrl.split(',').map((url) => url.trim())
    : ['http://localhost:3000'];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Request-ID',
      'Cache-Control',
      'Pragma',
      'Expires',
    ],
    exposedHeaders: ['Content-Disposition', 'X-Request-ID'],
    maxAge: 86400, // 24 hours
  });

  // ========================================
  // GLOBAL VALIDATION
  // ========================================

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: process.env.NODE_ENV === 'production',
      stopAtFirstError: true,
    }),
  );

  // ========================================
  // GLOBAL FILTERS & INTERCEPTORS
  // ========================================

  // Exception filter
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  // Logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor(logger));

  // Cache interceptor (requires CacheService and Reflector)
  const reflector = app.get('Reflector');
  const cacheService = app.get('CacheService');
  if (cacheService && reflector) {
    app.useGlobalInterceptors(new CacheInterceptor(cacheService, reflector));
    logger.log('🗄️  Response caching enabled');
  }

  // ========================================
  // ROUTES CONFIGURATION
  // ========================================

  // Global prefix for all routes
  app.setGlobalPrefix('api', {
    exclude: ['health', 'metrics'], // Health check endpoints
  });

  // ========================================
  // SWAGGER/OPENAPI DOCUMENTATION
  // ========================================

  if (environment !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Presentation Generator API')
      .setDescription('AI-powered presentation creation platform with real-time collaboration, analytics, and enterprise features')
      .setVersion('2.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('Auth', 'Authentication and authorization')
      .addTag('Projects', 'Presentation projects management')
      .addTag('Slides', 'Slide operations')
      .addTag('AI', 'AI-powered generation and personalization')
      .addTag('Collaboration', 'Real-time collaboration features')
      .addTag('Analytics', 'Presentation and engagement analytics')
      .addTag('Export', 'Export presentations to various formats')
      .addTag('Themes', 'Theme and design management')
      .addTag('Organizations', 'Organization and team management')
      .addTag('Payments', 'Subscription and payment processing')
      .addTag('Integrations', 'Third-party integrations')
      .addServer(`http://localhost:${port}/api`, 'Development')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
      customSiteTitle: 'Presentation Generator API Documentation',
    });

    logger.log(`📚 Swagger documentation available at http://localhost:${port}/api/docs`);
  }

  // ========================================
  // GRACEFUL SHUTDOWN
  // ========================================

  app.enableShutdownHooks();

  process.on('SIGTERM', () => {
    logger.log('SIGTERM signal received: closing HTTP server');
    app.close().catch((error) => {
      logger.error('Error during app close', error);
    });
  });

  process.on('SIGINT', () => {
    logger.log('SIGINT signal received: closing HTTP server');
    app.close().catch((error) => {
      logger.error('Error during app close', error);
    });
  });

  // ========================================
  // START SERVER
  // ========================================

  const port = configService.get<number>('PORT') || 3001;
  const environment = configService.get<string>('NODE_ENV') || 'development';

  await app.listen(port);

  logger.log(`🚀 Backend running on http://localhost:${port}`);
  logger.log(`📚 API available at http://localhost:${port}/api`);
  logger.log(`🌍 Environment: ${environment}`);
  logger.log(`🔒 CORS enabled for: ${allowedOrigins.join(', ')}`);
}

bootstrap().catch((error) => {
  const logger = new LoggerService('Bootstrap');
  logger.error('Failed to start application', error.stack);
  process.exit(1);
});
