export declare const UserRole: {
    readonly SALES_REP: "SALES_REP";
    readonly SALES_MANAGER: "SALES_MANAGER";
    readonly FINANCE: "FINANCE";
    readonly ADMIN: "ADMIN";
    readonly CUSTOMER: "CUSTOMER";
};
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export declare const QuotationStatus: {
    readonly DRAFT: "DRAFT";
    readonly SUBMITTED: "SUBMITTED";
    readonly AUTO_APPROVED: "AUTO_APPROVED";
    readonly PENDING_MANAGER: "PENDING_MANAGER";
    readonly PENDING_FINANCE: "PENDING_FINANCE";
    readonly APPROVED: "APPROVED";
    readonly REJECTED: "REJECTED";
    readonly RETURNED: "RETURNED";
    readonly CONFIRMED: "CONFIRMED";
    readonly FULFILLING: "FULFILLING";
    readonly NEGOTIATING: "NEGOTIATING";
    readonly COMPLETED: "COMPLETED";
};
export type QuotationStatus = (typeof QuotationStatus)[keyof typeof QuotationStatus];
export declare const LineType: {
    readonly ONE_TIME: "ONE_TIME";
    readonly RECURRING: "RECURRING";
};
export type LineType = (typeof LineType)[keyof typeof LineType];
export declare const RiskLevel: {
    readonly LOW: "LOW";
    readonly MEDIUM: "MEDIUM";
    readonly HIGH: "HIGH";
};
export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];
export declare const ApproverRole: {
    readonly SALES_MANAGER: "SALES_MANAGER";
    readonly FINANCE: "FINANCE";
};
export type ApproverRole = (typeof ApproverRole)[keyof typeof ApproverRole];
export declare const ApprovalStatus: {
    readonly PENDING: "PENDING";
    readonly APPROVED: "APPROVED";
    readonly REJECTED: "REJECTED";
    readonly RETURNED: "RETURNED";
    readonly SUPERSEDED: "SUPERSEDED";
};
export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];
export declare const ApprovalStepStatus: {
    readonly PENDING: "PENDING";
    readonly APPROVED: "APPROVED";
    readonly REJECTED: "REJECTED";
    readonly RETURNED: "RETURNED";
    readonly SKIPPED: "SKIPPED";
};
export type ApprovalStepStatus = (typeof ApprovalStepStatus)[keyof typeof ApprovalStepStatus];
export declare const ApprovalActionType: {
    readonly APPROVE: "APPROVE";
    readonly REJECT: "REJECT";
    readonly RETURN: "RETURN";
};
export type ApprovalActionType = (typeof ApprovalActionType)[keyof typeof ApprovalActionType];
export declare const DealHealthType: {
    readonly STALLED: "STALLED";
    readonly DISCOUNT_ANOMALY: "DISCOUNT_ANOMALY";
    readonly DELIVERY_SLIPPAGE: "DELIVERY_SLIPPAGE";
    readonly LOW_MARGIN: "LOW_MARGIN";
};
export type DealHealthType = (typeof DealHealthType)[keyof typeof DealHealthType];
export declare const DealHealthSeverity: {
    readonly INFO: "INFO";
    readonly WARN: "WARN";
    readonly CRITICAL: "CRITICAL";
};
export type DealHealthSeverity = (typeof DealHealthSeverity)[keyof typeof DealHealthSeverity];
