import { ApprovalActionType, ApprovalStatus, ApproverRole } from '@dealflow/contracts';
export declare class ListApprovalsQueryDto {
    /** ADMIN/FINANCE may pass this to widen the queue; reps always see their own. */
    status?: (typeof ApprovalStatus)[keyof typeof ApprovalStatus];
    role?: (typeof ApproverRole)[keyof typeof ApproverRole];
    page?: number;
    pageSize?: number;
}
export declare class ApprovalActionDto {
    action: (typeof ApprovalActionType)[keyof typeof ApprovalActionType];
    /** Required for REJECT and RETURN. The service enforces that; this only bounds it. */
    reason?: string;
}
