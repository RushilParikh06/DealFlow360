import { transitionReservation, availableQty, reserveStock } from './inventory-state.service';
import { AppError } from '../types';

describe('transitionReservation', () => {
  it('walks the happy path AVAILABLE -> RESERVED -> ALLOCATED -> SHIPPED', () => {
    expect(transitionReservation('AVAILABLE', 'RESERVED')).toBe('RESERVED');
    expect(transitionReservation('RESERVED', 'ALLOCATED')).toBe('ALLOCATED');
    expect(transitionReservation('ALLOCATED', 'SHIPPED')).toBe('SHIPPED');
  });

  it('release puts stock back to available for re-reservation', () => {
    expect(transitionReservation('RESERVED', 'RELEASED')).toBe('RELEASED');
    expect(transitionReservation('RELEASED', 'RESERVED')).toBe('RESERVED');
  });

  it('a shipped reservation is terminal', () => {
    expect(() => transitionReservation('SHIPPED', 'RELEASED')).toThrow(AppError);
    try {
      transitionReservation('SHIPPED', 'RELEASED');
    } catch (e) {
      expect((e as AppError).code).toBe('QUOTE_INVALID_STATE');
    }
  });

  it('skipping a state is rejected', () => {
    expect(() => transitionReservation('AVAILABLE', 'SHIPPED')).toThrow();
  });
});

describe('availableQty / reserveStock', () => {
  it('available is onHand minus reserved, never stored directly', () => {
    expect(availableQty(50, 12)).toBe(38);
  });

  it('reserving more than available raises INSUFFICIENT_STOCK', () => {
    expect(() => reserveStock(10, 8, 5)).toThrow(AppError);
    try {
      reserveStock(10, 8, 5);
    } catch (e) {
      expect((e as AppError).code).toBe('INSUFFICIENT_STOCK');
    }
    expect(reserveStock(10, 8, 2)).toBe(10);
  });
});
