export type FulfillmentStatus = 'ORDER_CONFIRMED' | 'INVENTORY_RESERVED' | 'PICKING' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'BACKORDERED';
/** The only function allowed to move a fulfillment between states. */
export declare function transitionFulfillment(from: FulfillmentStatus, to: FulfillmentStatus): FulfillmentStatus;
