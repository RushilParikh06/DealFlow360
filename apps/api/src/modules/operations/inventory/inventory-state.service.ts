import { AppError } from '../types';

export type ReservationStatus = 'AVAILABLE' | 'RESERVED' | 'ALLOCATED' | 'SHIPPED' | 'RELEASED';

// Plan.md section 7: "AVAILABLE -> RESERVED -> ALLOCATED -> SHIPPED", cancellation
// releases from RESERVED or ALLOCATED back to AVAILABLE. Anything else throws.
const TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  AVAILABLE: ['RESERVED'],
  RESERVED: ['ALLOCATED', 'RELEASED'],
  ALLOCATED: ['SHIPPED', 'RELEASED'],
  SHIPPED: [],
  RELEASED: ['RESERVED'],
};

/** The only function allowed to move a reservation between states. */
export function transitionReservation(from: ReservationStatus, to: ReservationStatus): ReservationStatus {
  if (!TRANSITIONS[from].includes(to)) {
    throw new AppError('QUOTE_INVALID_STATE', `cannot move reservation from ${from} to ${to}`, { from, to });
  }
  return to;
}

/** Available stock is derived, never stored (plan.md section 6). */
export function availableQty(onHand: number, reserved: number): number {
  return onHand - reserved;
}

/** Guards a reservation request against the derived available quantity. */
export function reserveStock(onHand: number, reserved: number, qty: number): number {
  if (qty > availableQty(onHand, reserved)) {
    throw new AppError('INSUFFICIENT_STOCK', 'not enough stock to reserve', { onHand, reserved, requested: qty });
  }
  return reserved + qty;
}
