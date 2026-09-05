export type ReservationStatus = 'AVAILABLE' | 'RESERVED' | 'ALLOCATED' | 'SHIPPED' | 'RELEASED';
/** The only function allowed to move a reservation between states. */
export declare function transitionReservation(from: ReservationStatus, to: ReservationStatus): ReservationStatus;
/** Available stock is derived, never stored (plan.md section 6). */
export declare function availableQty(onHand: number, reserved: number): number;
/** Guards a reservation request against the derived available quantity. */
export declare function reserveStock(onHand: number, reserved: number, qty: number): number;
