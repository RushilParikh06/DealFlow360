import { recommendAllocation, type WarehouseStock } from './allocation.service';

const stock: WarehouseStock[] = [
  { warehouseId: 'wh_main', warehouseName: 'Main Warehouse', productId: 'prd_1', available: 22, shippingCostMinor: 4200, currency: 'INR' },
  { warehouseId: 'wh_east', warehouseName: 'East Depot', productId: 'prd_1', available: 5, shippingCostMinor: 2900, currency: 'INR' },
];

describe('recommendAllocation', () => {
  it('prefers the cheapest warehouse first, splits only what it must', () => {
    // Matches the plan.md worked example: 24 units needed, cheapest (east) only
    // has 5, so main covers the rest even though it costs more per shipment.
    const result = recommendAllocation([{ productId: 'prd_1', qty: 24 }], stock);
    expect(result.allocations.map((a) => [a.warehouseId, a.qty])).toEqual([
      ['wh_east', 5],
      ['wh_main', 19],
    ]);
    expect(result.totalShipments).toBe(2);
    expect(result.backorder).toEqual([]);
  });

  it('a single warehouse covering the whole line needs one shipment', () => {
    const result = recommendAllocation([{ productId: 'prd_1', qty: 3 }], stock);
    expect(result.allocations.length).toBe(1);
    expect(result.allocations[0].warehouseId).toBe('wh_east');
  });

  it('demand exceeding every warehouse combined goes to backorder', () => {
    const result = recommendAllocation([{ productId: 'prd_1', qty: 100 }], stock);
    expect(result.backorder.length).toBe(1);
    expect(result.backorder[0].qty).toBe(100 - 27);
  });

  it('two lines for the same product do not double-spend one warehouse row', () => {
    const result = recommendAllocation(
      [{ productId: 'prd_1', qty: 5 }, { productId: 'prd_1', qty: 5 }],
      stock,
    );
    // First line drains east's 5 units; second line must fall through to main.
    expect(result.allocations.map((a) => a.warehouseId)).toEqual(['wh_east', 'wh_main']);
  });
});
