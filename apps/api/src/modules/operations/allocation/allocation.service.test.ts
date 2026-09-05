import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendAllocation, type WarehouseStock } from './allocation.service.ts';

const stock: WarehouseStock[] = [
  { warehouseId: 'wh_main', warehouseName: 'Main Warehouse', productId: 'prd_1', available: 22, shippingCostMinor: 4200, currency: 'INR' },
  { warehouseId: 'wh_east', warehouseName: 'East Depot', productId: 'prd_1', available: 5, shippingCostMinor: 2900, currency: 'INR' },
];

test('prefers the cheapest warehouse first, splits only what it must', () => {
  // Matches the plan.md worked example: 24 units needed, cheapest (east) only
  // has 5, so main covers the rest even though it costs more per shipment.
  const result = recommendAllocation([{ productId: 'prd_1', qty: 24 }], stock);
  assert.deepEqual(
    result.allocations.map((a) => [a.warehouseId, a.qty]),
    [['wh_east', 5], ['wh_main', 19]],
  );
  assert.equal(result.totalShipments, 2);
  assert.deepEqual(result.backorder, []);
});

test('a single warehouse covering the whole line needs one shipment', () => {
  const result = recommendAllocation([{ productId: 'prd_1', qty: 3 }], stock);
  assert.equal(result.allocations.length, 1);
  assert.equal(result.allocations[0].warehouseId, 'wh_east');
});

test('demand exceeding every warehouse combined goes to backorder', () => {
  const result = recommendAllocation([{ productId: 'prd_1', qty: 100 }], stock);
  assert.equal(result.backorder.length, 1);
  assert.equal(result.backorder[0].qty, 100 - 27);
});

test('two lines for the same product do not double-spend one warehouse row', () => {
  const result = recommendAllocation(
    [{ productId: 'prd_1', qty: 5 }, { productId: 'prd_1', qty: 5 }],
    stock,
  );
  // First line drains east's 5 units; second line must fall through to main.
  assert.deepEqual(result.allocations.map((a) => a.warehouseId), ['wh_east', 'wh_main']);
});
