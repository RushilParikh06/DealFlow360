import type { UpsellSuggestion } from '@dealflow/contracts';
import { OpsReaderService } from './ops-reader.service';
import { QuoteReaderService } from './quote-reader.service';
export declare class UpsellService {
    private readonly quotes;
    private readonly ops;
    constructor(quotes: QuoteReaderService, ops: OpsReaderService);
    forQuotation(quotationId: string, limit?: number): Promise<UpsellSuggestion[]>;
}
