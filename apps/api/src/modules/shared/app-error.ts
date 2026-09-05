// GROUP OWNED. One error envelope, one stable code constant (plan.md invariant 8).
// Throw AppError everywhere. The filter turns it into the documented body and
// picks the HTTP status from the code table, so no handler chooses a status.

import { ERROR_HTTP_STATUS, type ErrorCode } from '@dealflow/contracts';

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  get status(): number {
    return ERROR_HTTP_STATUS[this.code] ?? 500;
  }
}
