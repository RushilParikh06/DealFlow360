"use strict";
// GROUP OWNED BY PROTOCOL. Mirrors prisma/schema/base.prisma exactly.
// Adding, renaming or removing a value here needs all four to agree.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DealHealthSeverity = exports.DealHealthType = exports.ApprovalActionType = exports.ApprovalStepStatus = exports.ApprovalStatus = exports.ApproverRole = exports.RiskLevel = exports.LineType = exports.QuotationStatus = exports.UserRole = void 0;
exports.UserRole = {
    SALES_REP: 'SALES_REP',
    SALES_MANAGER: 'SALES_MANAGER',
    FINANCE: 'FINANCE',
    ADMIN: 'ADMIN',
    CUSTOMER: 'CUSTOMER',
};
exports.QuotationStatus = {
    DRAFT: 'DRAFT',
    SUBMITTED: 'SUBMITTED',
    AUTO_APPROVED: 'AUTO_APPROVED',
    PENDING_MANAGER: 'PENDING_MANAGER',
    PENDING_FINANCE: 'PENDING_FINANCE',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    RETURNED: 'RETURNED',
    CONFIRMED: 'CONFIRMED',
    FULFILLING: 'FULFILLING',
    NEGOTIATING: 'NEGOTIATING',
    COMPLETED: 'COMPLETED',
};
exports.LineType = { ONE_TIME: 'ONE_TIME', RECURRING: 'RECURRING' };
exports.RiskLevel = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' };
exports.ApproverRole = { SALES_MANAGER: 'SALES_MANAGER', FINANCE: 'FINANCE' };
exports.ApprovalStatus = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    RETURNED: 'RETURNED',
    SUPERSEDED: 'SUPERSEDED',
};
exports.ApprovalStepStatus = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    RETURNED: 'RETURNED',
    SKIPPED: 'SKIPPED',
};
exports.ApprovalActionType = {
    APPROVE: 'APPROVE',
    REJECT: 'REJECT',
    RETURN: 'RETURN',
};
exports.DealHealthType = {
    STALLED: 'STALLED',
    DISCOUNT_ANOMALY: 'DISCOUNT_ANOMALY',
    DELIVERY_SLIPPAGE: 'DELIVERY_SLIPPAGE',
    LOW_MARGIN: 'LOW_MARGIN',
};
exports.DealHealthSeverity = { INFO: 'INFO', WARN: 'WARN', CRITICAL: 'CRITICAL' };
//# sourceMappingURL=enums.js.map