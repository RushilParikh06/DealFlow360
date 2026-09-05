export declare const ErrorCode: {
    readonly VALIDATION_FAILED: "VALIDATION_FAILED";
    readonly UNAUTHENTICATED: "UNAUTHENTICATED";
    readonly FORBIDDEN: "FORBIDDEN";
    readonly PORTAL_SCOPE_VIOLATION: "PORTAL_SCOPE_VIOLATION";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly QUOTE_INVALID_STATE: "QUOTE_INVALID_STATE";
    readonly DISCOUNT_LIMIT_EXCEEDED: "DISCOUNT_LIMIT_EXCEEDED";
    readonly APPROVAL_STEP_NOT_YOURS: "APPROVAL_STEP_NOT_YOURS";
    readonly INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK";
    readonly INVOICE_BEFORE_SHIPMENT: "INVOICE_BEFORE_SHIPMENT";
    readonly SUBSCRIPTION_INVALID_STATE: "SUBSCRIPTION_INVALID_STATE";
    readonly POLICY_NOT_CONFIGURED: "POLICY_NOT_CONFIGURED";
    readonly APPROVAL_ALREADY_CLOSED: "APPROVAL_ALREADY_CLOSED";
};
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
export declare const ERROR_HTTP_STATUS: Record<ErrorCode, number>;
export interface ApiErrorBody {
    success: false;
    error: {
        code: ErrorCode;
        message: string;
        details?: Record<string, unknown>;
    };
}
export interface ApiSuccessBody<T> {
    success: true;
    data: T;
}
export interface Paginated<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}
