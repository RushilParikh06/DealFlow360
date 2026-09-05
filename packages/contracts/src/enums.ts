// GROUP OWNED BY PROTOCOL. Mirrors prisma/schema/base.prisma exactly.
// Adding, renaming or removing a value here needs all four to agree.

export const UserRole = {
  SALES_REP: 'SALES_REP',
  SALES_MANAGER: 'SALES_MANAGER',
  FINANCE: 'FINANCE',
  ADMIN: 'ADMIN',
  CUSTOMER: 'CUSTOMER',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const QuotationStatus = {
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
} as const;
export type QuotationStatus = (typeof QuotationStatus)[keyof typeof QuotationStatus];

export const LineType = { ONE_TIME: 'ONE_TIME', RECURRING: 'RECURRING' } as const;
export type LineType = (typeof LineType)[keyof typeof LineType];

export const RiskLevel = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' } as const;
export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];

export const ApproverRole = { SALES_MANAGER: 'SALES_MANAGER', FINANCE: 'FINANCE' } as const;
export type ApproverRole = (typeof ApproverRole)[keyof typeof ApproverRole];

export const ApprovalStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  RETURNED: 'RETURNED',
  SUPERSEDED: 'SUPERSEDED',
} as const;
export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

export const ApprovalStepStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  RETURNED: 'RETURNED',
  SKIPPED: 'SKIPPED',
} as const;
export type ApprovalStepStatus = (typeof ApprovalStepStatus)[keyof typeof ApprovalStepStatus];

export const ApprovalActionType = {
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  RETURN: 'RETURN',
} as const;
export type ApprovalActionType = (typeof ApprovalActionType)[keyof typeof ApprovalActionType];

export const DealHealthType = {
  STALLED: 'STALLED',
  DISCOUNT_ANOMALY: 'DISCOUNT_ANOMALY',
  DELIVERY_SLIPPAGE: 'DELIVERY_SLIPPAGE',
  LOW_MARGIN: 'LOW_MARGIN',
} as const;
export type DealHealthType = (typeof DealHealthType)[keyof typeof DealHealthType];

export const DealHealthSeverity = { INFO: 'INFO', WARN: 'WARN', CRITICAL: 'CRITICAL' } as const;
export type DealHealthSeverity = (typeof DealHealthSeverity)[keyof typeof DealHealthSeverity];
