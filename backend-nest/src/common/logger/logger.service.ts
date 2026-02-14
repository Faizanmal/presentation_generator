import {
  Injectable,
  LoggerService as NestLoggerService,
  Scope,
} from '@nestjs/common';
import * as winston from 'winston';
import { Request } from 'express';

// NOTE: ensure 'winston' is installed in package.json (we'll add it if missing)

/**
 * Custom logger service using Winston for structured logging
 */
@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  private logger: winston.Logger;
  private context?: string;

  constructor(context?: string) {
    this.context = context;
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json(),
      ),
      defaultMeta: { service: 'presentation-designer' },
      transports: [
        // Console transport with colorized output for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(
              ({ timestamp, level, message, context, ...metadata }) => {
                let msg = `${timestamp} [${level}]`;
                if (context) msg += ` [${context}]`;
                msg += `: ${message}`;

                if (Object.keys(metadata).length > 0) {
                  msg += ` ${JSON.stringify(metadata)}`;
                }

                return msg;
              },
            ),
          ),
        }),
        // File transport for errors
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
        // File transport for all logs
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 5242880,
          maxFiles: 5,
        }),
      ],
    });

    // Add daily rotation in production
    if (process.env.NODE_ENV === 'production') {
      const DailyRotateFile = require('winston-daily-rotate-file');

      this.logger.add(
        new DailyRotateFile({
          filename: 'logs/application-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d',
        }),
      );
    }
  }

  setContext(context: string) {
    this.context = context;
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context: context || this.context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, {
      context: context || this.context,
      trace,
    });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context: context || this.context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context: context || this.context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context: context || this.context });
  }

  /**
   * Log HTTP request
   */
  logRequest(req: Request, context?: string) {
    this.logger.info('HTTP Request', {
      context: context || this.context,
      method: req.method,
      path: req.path,
      query: req.query,
      ip: this.getClientIp(req),
      userAgent: req.headers['user-agent'],
      userId: (req as any).user?.id,
    });
  }

  /**
   * Log HTTP response
   */
  logResponse(
    req: Request,
    statusCode: number,
    responseTime: number,
    context?: string,
  ) {
    this.logger.info('HTTP Response', {
      context: context || this.context,
      method: req.method,
      path: req.path,
      statusCode,
      responseTime: `${responseTime}ms`,
      userId: (req as any).user?.id,
    });
  }

  /**
   * Log error with additional context
   */
  logError(
    error: Error,
    context?: string,
    additionalInfo?: Record<string, any>,
  ) {
    this.logger.error('Error occurred', {
      context: context || this.context,
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...additionalInfo,
    });
  }

  /**
   * Log security event
   */
  logSecurityEvent(
    event: string,
    details: Record<string, any>,
    context?: string,
  ) {
    this.logger.warn('Security Event', {
      context: context || this.context,
      event,
      ...details,
    });
  }

  /**
   * Log performance metric
   */
  logPerformance(operation: string, duration: number, context?: string) {
    this.logger.info('Performance Metric', {
      context: context || this.context,
      operation,
      duration: `${duration}ms`,
    });
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const realIpHeader = req.headers['x-real-ip'];
    const realIp = Array.isArray(realIpHeader) ? realIpHeader[0] : realIpHeader;

    return (
      (forwardedIp ? forwardedIp.split(',')[0].trim() : undefined) ||
      realIp ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }
}
