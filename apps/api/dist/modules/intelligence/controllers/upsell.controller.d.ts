import type { UpsellSuggestion } from '@dealflow/contracts';
import { UpsellQueryDto } from '../dto/upsell.dto';
import { UpsellService } from '../services/upsell.service';
export declare class UpsellController {
    private readonly upsell;
    constructor(upsell: UpsellService);
    forQuote(id: string, query: UpsellQueryDto): Promise<UpsellSuggestion[]>;
}
