/**
 * B2 -> F handoff. Typed accessors over intelligence-fixtures.json.
 *
 * The JSON is GENERATED from the real engine, so these are the exact numbers the
 * API returns for the seeded demo quotes. Build every intelligence screen against
 * this file, then replace the bodies with fetch() calls when the API is up. The
 * types come from @dealflow/contracts, so if B2 changes a shape your build breaks
 * here rather than silently at runtime on stage.
 *
 * Requires "resolveJsonModule": true in apps/web/tsconfig.json.
 */

import type {
  AllocationResponse,
  ApprovalDetail,
  ApprovalListItem,
  AuditEntry,
  DealHealthItem,
  DiscountPolicyView,
  EvaluationResponse,
  Paginated,
  UpsellSuggestion,
} from '@dealflow/contracts';
import fixtures from './intelligence-fixtures.json';

const f = fixtures as unknown as Record<string, { success: boolean; data?: unknown; error?: unknown }>;
const data = <T>(key: string): T => f[key]!.data as T;

/** QT-1001: one big services breach. HIGH, 80, Manager then Finance. */
export const evaluationHigh = (): EvaluationResponse => data('POST /api/v1/quotes/qt_1001/evaluate');

/** QT-1002: four small breaches an order-level cap would miss. MEDIUM, 59, Manager only. */
export const evaluationMedium = (): EvaluationResponse => data('POST /api/v1/quotes/qt_1002/evaluate');

/** QT-1003: fully compliant. Score 0, nobody has to approve anything. */
export const evaluationClean = (): EvaluationResponse => data('POST /api/v1/quotes/qt_1003/evaluate');

export const approvalQueue = (): Paginated<ApprovalListItem> => data('GET /api/v1/approvals');
export const approvalDetailPending = (): ApprovalDetail => data('GET /api/v1/approvals/apr_1001');
export const approvalDetailApproved = (): ApprovalDetail =>
  data('PATCH /api/v1/approvals/apr_1001 (after both approvals)');

export const upsellSuggestions = (): UpsellSuggestion[] => data('GET /api/v1/quotes/qt_1001/upsell');
export const allocationPlan = (): AllocationResponse => data('GET /api/v1/orders/ord_2001/allocation-plan');
export const discountPolicies = (): DiscountPolicyView[] => data('GET /api/v1/discount-policies');
export const dealHealth = (): DealHealthItem[] => data('GET /api/v1/deal-health');
export const auditTrail = (): AuditEntry[] => data('GET /api/v1/quotes/qt_1001/audit-trail');

/** The failure shape. Every non-2xx response from the api looks exactly like this. */
export const errorEnvelope = () => f['ERROR ENVELOPE (any 4xx/5xx)'];
