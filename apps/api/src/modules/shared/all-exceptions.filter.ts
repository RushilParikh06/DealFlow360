// GROUP OWNED. Every failure leaves the process in the shape from plan.md
// section 8, including the ones nobody wrote a handler for.

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ErrorCode, type ApiErrorBody } from '@dealflow/contracts';
import { AppError } from './app-error';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof AppError) {
      const body: ApiErrorBody = {
        success: false,
        error: { code: exception.code, message: exception.message, details: exception.details },
      };
      res.status(exception.status).json(body);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse() as string | { message?: unknown };
      const message =
        typeof raw === 'string' ? raw : (Array.isArray(raw?.message) ? raw.message.join('; ') : String(raw?.message ?? exception.message));

      const code =
        status === 400
          ? ErrorCode.VALIDATION_FAILED
          : status === 401
            ? ErrorCode.UNAUTHENTICATED
            : status === 403
              ? ErrorCode.FORBIDDEN
              : status === 404
                ? ErrorCode.NOT_FOUND
                : ErrorCode.VALIDATION_FAILED;

      const body: ApiErrorBody = { success: false, error: { code, message } };
      res.status(status).json(body);
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: 'Unexpected server error.' },
    });
  }
}
