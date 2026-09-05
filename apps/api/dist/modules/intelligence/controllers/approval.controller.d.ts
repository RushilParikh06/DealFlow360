import type { ApprovalDetail, ApprovalListItem, Paginated } from '@dealflow/contracts';
import { type AuthUser } from '../../shared/current-user';
import { ApprovalActionDto, ListApprovalsQueryDto } from '../dto/approval.dto';
import { ApprovalService } from '../services/approval.service';
export declare class ApprovalController {
    private readonly approvals;
    constructor(approvals: ApprovalService);
    list(query: ListApprovalsQueryDto, actor: AuthUser): Promise<Paginated<ApprovalListItem>>;
    detail(id: string): Promise<ApprovalDetail>;
    act(id: string, body: ApprovalActionDto, actor: AuthUser): Promise<ApprovalDetail>;
}
