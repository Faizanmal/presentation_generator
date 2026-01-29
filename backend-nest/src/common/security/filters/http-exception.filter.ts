import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { v4 as uuidv4 } from 'uuid';

interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  requestId: string;
  path: string;
  details?: any;
}

/**
 * Production-ready exception filter with comprehensive error handling
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    const requestId = response.getHeader('X-Request-ID')?.toString() || uuidv4();
    const timestamp = new Date().toISOString();
    const path = request.url;

    let statusCode: number;
    let message: string;
    let error: string;
    let details: any;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.name;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as any;
        message = resp.message || exception.message;
        error = resp.error || exception.name;
        details = resp.details;
      } else {
        message = exception.message;
        error = exception.name;
      }
    } else if (exception instanceof Error) {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = exception.name;

      // Log the full error for debugging
      this.logger.error(
        `[${requestId}] Unhandled error: ${exception.message}`,
        exception.stack,
      );
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected error occurred';
      error = 'UnknownError';

      this.logger.error(`[${requestId}] Unknown exception type:`, exception);
    }

    // Don't expose internal errors to clients
    if (statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      message = 'Internal server error';
      details = undefined;
    }

    const errorResponse: ErrorResponse = {
      statusCode,
      message: Array.isArray(message) ? message.join(', ') : message,
      error,
      timestamp,
      requestId,
      path,
    };

    if (details && statusCode !== HttpStatus.INTERNAL_SERVER_ERROR) {
      errorResponse.details = details;
    }

    // Log error based on severity
    if (statusCode >= 500) {
      this.logger.error(
        `[${requestId}] ${statusCode} ${error}: ${message} - ${path}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else if (statusCode >= 400) {
      this.logger.warn(`[${requestId}] ${statusCode} ${error}: ${message} - ${path}`);
    }

    response.status(statusCode).json(errorResponse);
  }
}
