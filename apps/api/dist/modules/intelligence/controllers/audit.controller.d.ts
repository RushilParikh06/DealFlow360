import type { AuditEntry } from '@dealflow/contracts';
import { AuditQueryDto } from '../dto/audit.dto';
import { AuditService } from '../services/audit.service';
export declare class AuditController {
    private readonly audit;
    constructor(audit: AuditService);
    list(query: AuditQueryDto): Promise<AuditEntry[]>;
    trail(id: string): Promise<AuditEntry[]>;
}
