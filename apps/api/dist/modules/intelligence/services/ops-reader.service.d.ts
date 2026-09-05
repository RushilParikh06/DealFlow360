import { PrismaService } from '../../shared/prisma.service';
import type { StockRow } from '../engine/allocation';
import type { UpsellCandidate } from '../engine/upsell';
export declare class OpsReaderService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    /**
     * available = onHand - reserved, computed here and never stored (invariant,
     * plan.md section 6). Reserved counts B2's own inventory_reservations rows,
     * not a denormalised column somebody forgot to decrement.
     */
    loadStock(productIds: string[]): Promise<StockRow[]>;
    loadOrderDemand(orderId: string): Promise<{
        currency: string;
        demand: Array<{
            productId: string;
            qty: number;
        }>;
    }>;
    /**
     * B3 supplies the pairs and the attach rate. B2 attaches the ceiling-safe
     * discount for the customer's tier, so every suggestion is one a rep can
     * actually give without sending their own quote back into approval.
     */
    loadUpsellCandidates(productIdsOnQuote: string[], tierId: string): Promise<UpsellCandidate[]>;
}
