import type { DealHealthItem } from '@dealflow/contracts';
import { type AuthUser } from '../../shared/current-user';
import { DealHealthQueryDto } from '../dto/deal-health.dto';
import { DealHealthService } from '../services/deal-health.service';
export declare class DealHealthController {
    private readonly health;
    constructor(health: DealHealthService);
    list(query: DealHealthQueryDto): Promise<DealHealthItem[]>;
    /** The demo presses this. Idempotent, so pressing it twice is not a story. */
    refresh(): Promise<{
        scanned: number;
        findings: number;
    }>;
    forQuote(id: string): Promise<DealHealthItem[]>;
    nudge(eventId: string, actor: AuthUser): Promise<DealHealthItem>;
}
