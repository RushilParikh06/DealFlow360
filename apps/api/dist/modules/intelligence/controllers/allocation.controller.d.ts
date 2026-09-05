import type { AllocationResponse } from '@dealflow/contracts';
import { type AuthUser } from '../../shared/current-user';
import { AllocationService } from '../services/allocation.service';
export declare class AllocationController {
    private readonly allocation;
    constructor(allocation: AllocationService);
    plan(id: string): Promise<AllocationResponse>;
    reserve(id: string, actor: AuthUser): Promise<AllocationResponse>;
    release(id: string, actor: AuthUser): Promise<{
        released: number;
    }>;
}
