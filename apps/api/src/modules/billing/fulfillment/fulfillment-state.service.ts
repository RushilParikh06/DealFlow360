import { AppError } from '../../operations/types';

export type FulfillmentStatus =
  | 'ORDER_CONFIRMED'
  | 'INVENTORY_RESERVED'
  | 'PICKING'
  | 'PACKED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'BACKORDERED';

// Plan.md section 7. BACKORDERED can be entered from reservation (stock came up
// short) and left once inventory arrives, re-joining the normal path.
const TRANSITIONS: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  ORDER_CONFIRMED: ['INVENTORY_RESERVED', 'BACKORDERED'],
  INVENTORY_RESERVED: ['PICKING', 'BACKORDERED'],
  PICKING: ['PACKED'],
  PACKED: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  BACKORDERED: ['INVENTORY_RESERVED'],
};

/** The only function allowed to move a fulfillment between states. */
export function transitionFulfillment(from: FulfillmentStatus, to: FulfillmentStatus): FulfillmentStatus {
  if (!TRANSITIONS[from].includes(to)) {
    throw new AppError('QUOTE_INVALID_STATE', `cannot move fulfillment from ${from} to ${to}`, { from, to });
  }
  return to;
}
