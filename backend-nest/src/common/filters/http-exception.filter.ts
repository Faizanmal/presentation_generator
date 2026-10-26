import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../logger/logger.service';

/**
 * Global exception filter for handling all HTTP exceptions
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('ExceptionFilter');
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'InternalServerError';
    let details: unknown = undefined;
    let code: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = (responseObj.message as string | string[]) || message;
        error = (responseObj.error as string) || error;
        details = responseObj.details;
        if (typeof responseObj.code === 'string') {
          code = responseObj.code;
        }
      }
    } else if (
      exception instanceof Error &&
      (exception.name === 'ForbiddenError' || /csrf/i.test(exception.message))
    ) {
      status = HttpStatus.FORBIDDEN;
      message = 'Invalid CSRF token';
      error = 'Forbidden';
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;

      // Log full error with stack trace
      this.logger.logError(exception, 'ExceptionFilter', {
        path: request.url,
        method: request.method,
        userId: (request as unknown as { user?: { id?: string } }).user?.id,
      });
    }

    // Don't expose internal errors in production
    if (
      status === HttpStatus.INTERNAL_SERVER_ERROR &&
      process.env.NODE_ENV === 'production'
    ) {
      message = 'An unexpected error occurred';
      details = undefined;
    }

    const normalizedMessage = Array.isArray(message)
      ? message.join(', ')
      : message;

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error,
      message: normalizedMessage,
      ...(code ? { code } : {}),
      ...(details ? { details } : {}),
      ...(process.env.NODE_ENV === 'development' &&
        exception instanceof Error && {
          stack: exception.stack,
        }),
    };

    // Log based on severity. 404s on / are Render port scans, not app errors.
    const path = request.path || request.url.split('?')[0];
    const isPortScan =
      status === HttpStatus.NOT_FOUND &&
      (request.method === 'GET' || request.method === 'HEAD') &&
      (path === '/' || path === '');

    if (!isPortScan) {
      if (status >= 500) {
        this.logger.error(
          `${request.method} ${request.url} ${status} - ${normalizedMessage}`,
          exception instanceof Error ? exception.stack : undefined,
          'ExceptionFilter',
        );
      } else {
        this.logger.warn(
          `${request.method} ${request.url} ${status} - ${normalizedMessage}`,
          'ExceptionFilter',
        );
      }
    }

    response.status(status).json(errorResponse);
  }
}

/**
 * HTTP exception filter for specific HTTP exceptions
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('HttpExceptionFilter');
  }

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message: string | string[];
    let error: string;
    let code: string | undefined;
    let details: unknown;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
      error = exception.name;
    } else {
      const responseObj = exceptionResponse as Record<string, unknown>;
      message = (responseObj.message as string | string[]) || 'An error occurred';
      error = (responseObj.error as string) || exception.name;
      details = responseObj.details;
      if (typeof responseObj.code === 'string') {
        code = responseObj.code;
      }
    }

    const normalizedMessage = Array.isArray(message)
      ? message.join(', ')
      : message;

    // Log based on severity
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${status} - ${JSON.stringify(normalizedMessage)}`,
        exception.stack,
      );
    } else if (status >= 400) {
      this.logger.warn(
        `${request.method} ${request.url} ${status} - ${JSON.stringify(normalizedMessage)}`,
      );
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error,
      message: normalizedMessage,
      ...(code ? { code } : {}),
      ...(details ? { details } : {}),
      ...(process.env.NODE_ENV === 'development' && {
        stack: exception.stack,
      }),
    };

    response.status(status).json(errorResponse);
  }
}
