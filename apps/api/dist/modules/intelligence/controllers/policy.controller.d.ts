import type { DiscountPolicyView } from '@dealflow/contracts';
import { type AuthUser } from '../../shared/current-user';
import { UpdatePolicyDto } from '../dto/policy.dto';
import { PolicyService } from '../services/policy.service';
export declare class PolicyController {
    private readonly policies;
    constructor(policies: PolicyService);
    list(): Promise<DiscountPolicyView[]>;
    update(id: string, body: UpdatePolicyDto, actor: AuthUser): Promise<DiscountPolicyView>;
}
