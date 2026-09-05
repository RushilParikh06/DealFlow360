import { transitionFulfillment } from './fulfillment-state.service';
import { AppError } from '../../operations/types';

describe('transitionFulfillment', () => {
  it('walks the happy path to delivered', () => {
    const path: Parameters<typeof transitionFulfillment>[] = [
      ['ORDER_CONFIRMED', 'INVENTORY_RESERVED'],
      ['INVENTORY_RESERVED', 'PICKING'],
      ['PICKING', 'PACKED'],
      ['PACKED', 'SHIPPED'],
      ['SHIPPED', 'DELIVERED'],
    ];
    for (const [from, to] of path) expect(transitionFulfillment(from, to)).toBe(to);
  });

  it('a short reservation can fall into backordered and recover', () => {
    expect(transitionFulfillment('ORDER_CONFIRMED', 'BACKORDERED')).toBe('BACKORDERED');
    expect(transitionFulfillment('BACKORDERED', 'INVENTORY_RESERVED')).toBe('INVENTORY_RESERVED');
  });

  it('delivered is terminal and skipping steps is rejected', () => {
    expect(() => transitionFulfillment('DELIVERED', 'SHIPPED')).toThrow(AppError);
    try {
      transitionFulfillment('DELIVERED', 'SHIPPED');
    } catch (e) {
      expect((e as AppError).code).toBe('QUOTE_INVALID_STATE');
    }
    expect(() => transitionFulfillment('PICKING', 'SHIPPED')).toThrow();
  });
});
