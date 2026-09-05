import type { Money } from './money';
import type { ApprovalActionType, ApprovalStatus, ApprovalStepStatus, ApproverRole, DealHealthSeverity, DealHealthType, RiskLevel, UserRole } from './enums';
/** One line that broke its own category ceiling. */
export interface DiscountViolation {
    quoteLineId: string;
    productId: string;
    categoryName: string;
    allowedBps: number;
    actualBps: number;
    excessBps: number;
    lineTotal: Money;
}
/** One named contributor to the risk score. Screen 6 renders this list as-is. */
export interface RiskFactor {
    key: 'BLENDED_EXCESS' | 'WORST_LINE_EXCESS' | 'MARGIN_PRESSURE' | 'VIOLATION_SPREAD';
    label: string;
    points: number;
    maxPoints: number;
    detail: string;
}
export interface BlendedBreakdown {
    weightedExcessBps: number;
    worstLineExcessBps: number;
    marginBps: number;
}
/** Response of POST /quotes/:id/evaluate. Everything else is built on this. */
export interface EvaluationResponse {
    evaluationId: string;
    quotationId: string;
    riskScore: number;
    riskLevel: RiskLevel;
    approvalRequired: boolean;
    requiredApprovals: ApproverRole[];
    violations: DiscountViolation[];
    blended: BlendedBreakdown;
    factors: RiskFactor[];
    /** Per line, so the builder screen can badge OVER without a second round trip. */
    lineCeilings: Array<{
        quoteLineId: string;
        allowedDiscountBps: number;
        actualDiscountBps: number;
        overBps: number;
    }>;
    net: Money;
    evaluatedAt: string;
}
export interface ApprovalStepView {
    id: string;
    sequence: number;
    approverRole: ApproverRole;
    status: ApprovalStepStatus;
    decidedByUserId: string | null;
    decidedAt: string | null;
    actions: Array<{
        id: string;
        actionType: ApprovalActionType;
        actorUserId: string;
        actorRole: UserRole;
        reason: string | null;
        createdAt: string;
    }>;
}
export interface ApprovalListItem {
    id: string;
    quotationId: string;
    quotationCode: string;
    customerName: string;
    status: ApprovalStatus;
    currentStep: ApproverRole | null;
    riskScore: number;
    riskLevel: RiskLevel;
    total: Money;
    createdAt: string;
}
export interface ApprovalDetail extends ApprovalListItem {
    evaluation: EvaluationResponse;
    steps: ApprovalStepView[];
    audit: AuditEntry[];
}
export interface AuditEntry {
    id: string;
    entityType: string;
    entityId: string;
    action: string;
    actorUserId: string | null;
    actorRole: UserRole | null;
    fromValue: string | null;
    toValue: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
}
export interface UpsellSuggestion {
    productId: string;
    productName: string;
    kind: 'UPSELL' | 'CROSS_SELL';
    suggestedQty: number;
    unitPrice: Money;
    /** Gross margin the line would add at the ceiling-safe discount. */
    marginDelta: Money;
    marginBps: number;
    attachRateBps: number;
    /** marginDelta weighted by attach rate. The rank key. */
    expectedMargin: Money;
    rank: number;
}
export interface AllocationLine {
    warehouseId: string;
    warehouseName: string;
    productId: string;
    qty: number;
    shipments: number;
    shippingCost: Money;
}
export interface AllocationResponse {
    orderId: string;
    allocations: AllocationLine[];
    backorder: Array<{
        productId: string;
        qty: number;
        reason: string;
    }>;
    totalShipments: number;
    totalShippingCost: Money;
}
export interface DealHealthItem {
    id: string;
    quotationId: string;
    quotationCode: string;
    customerName: string;
    type: DealHealthType;
    severity: DealHealthSeverity;
    message: string;
    metadata: Record<string, unknown> | null;
    detectedAt: string;
    resolvedAt: string | null;
    nudgedAt: string | null;
}
export interface DiscountPolicyView {
    id: string;
    tierId: string;
    tierCode: string;
    categoryId: string | null;
    categoryName: string | null;
    maxDiscountBps: number;
    requiresManagerAboveBps: number;
    requiresFinanceAboveBps: number;
    isActive: boolean;
}
