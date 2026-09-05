import { type ErrorCode } from '@dealflow/contracts';
export declare class AppError extends Error {
    readonly code: ErrorCode;
    readonly details?: Record<string, unknown> | undefined;
    constructor(code: ErrorCode, message: string, details?: Record<string, unknown> | undefined);
    get status(): number;
}
