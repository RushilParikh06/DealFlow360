import { chooseAllocation, type StockRow } from '../allocation';

const stock: StockRow[] = [
  { warehouseId: 'wh_main', warehouseName: 'Main Warehouse', productId: 'prd_1', availableQty: 22, shipmentCostMinor: 4200 },
  { warehouseId: 'wh_east', warehouseName: 'East Depot', productId: 'prd_1', availableQty: 10, shipmentCostMinor: 2900 },
];

describe('warehouse split', () => {
  it('ships from one warehouse when one warehouse can cover it', () => {
    const r = chooseAllocation('ord_1', [{ productId: 'prd_1', qty: 20 }], stock, 'INR');
    expect(r.allocations).toHaveLength(1);
    expect(r.allocations[0]).toMatchObject({ warehouseId: 'wh_main', qty: 20 });
    expect(r.totalShipments).toBe(1);
    expect(r.backorder).toEqual([]);
  });

  it('reproduces the split from plan.md section 8', () => {
    const r = chooseAllocation('ord_1', [{ productId: 'prd_1', qty: 24 }], stock, 'INR');
    expect(r.allocations).toEqual([
      { warehouseId: 'wh_main', warehouseName: 'Main Warehouse', productId: 'prd_1', qty: 22, shipments: 1, shippingCost: { amountMinor: 4200, currency: 'INR' } },
      { warehouseId: 'wh_east', warehouseName: 'East Depot', productId: 'prd_1', qty: 2, shipments: 1, shippingCost: { amountMinor: 2900, currency: 'INR' } },
    ]);
    expect(r.totalShipments).toBe(2);
    expect(r.totalShippingCost).toEqual({ amountMinor: 7100, currency: 'INR' });
  });

  it('backorders only the uncovered remainder', () => {
    const r = chooseAllocation('ord_1', [{ productId: 'prd_1', qty: 40 }], stock, 'INR');
    expect(r.allocations.reduce((s, a) => s + a.qty, 0)).toBe(32);
    expect(r.backorder).toEqual([
      { productId: 'prd_1', qty: 8, reason: 'Demand exceeds available stock across all warehouses.' },
    ]);
  });

  it('says so plainly when nobody stocks the product', () => {
    const r = chooseAllocation('ord_1', [{ productId: 'prd_ghost', qty: 5 }], stock, 'INR');
    expect(r.allocations).toEqual([]);
    expect(r.backorder[0]).toMatchObject({ qty: 5, reason: 'No warehouse stocks this product.' });
  });

  it('never double spends the same shelf across two lines', () => {
    const shared: StockRow[] = [
      { warehouseId: 'wh_main', warehouseName: 'Main', productId: 'prd_1', availableQty: 5, shipmentCostMinor: 100 },
      { warehouseId: 'wh_main', warehouseName: 'Main', productId: 'prd_2', availableQty: 5, shipmentCostMinor: 100 },
    ];
    const r = chooseAllocation('ord_1', [{ productId: 'prd_1', qty: 5 }, { productId: 'prd_2', qty: 7 }], shared, 'INR');
    expect(r.allocations.filter((a) => a.productId === 'prd_1')[0]!.qty).toBe(5);
    expect(r.backorder).toEqual([{ productId: 'prd_2', qty: 2, reason: 'Demand exceeds available stock across all warehouses.' }]);
    expect(r.totalShipments).toBe(1); // one warehouse, one shipment, two products
  });

  it('breaks a stock tie on the cheaper shipment', () => {
    const tied: StockRow[] = [
      { warehouseId: 'wh_far', warehouseName: 'Far', productId: 'prd_1', availableQty: 10, shipmentCostMinor: 9000 },
      { warehouseId: 'wh_near', warehouseName: 'Near', productId: 'prd_1', availableQty: 10, shipmentCostMinor: 1000 },
    ];
    const r = chooseAllocation('ord_1', [{ productId: 'prd_1', qty: 6 }], tied, 'INR');
    expect(r.allocations[0]!.warehouseId).toBe('wh_near');
  });

  it('treats negative available stock as zero rather than inventing units', () => {
    const broken: StockRow[] = [
      { warehouseId: 'wh_bad', warehouseName: 'Bad', productId: 'prd_1', availableQty: -3, shipmentCostMinor: 100 },
    ];
    const r = chooseAllocation('ord_1', [{ productId: 'prd_1', qty: 2 }], broken, 'INR');
    expect(r.allocations).toEqual([]);
    expect(r.backorder[0]!.qty).toBe(2);
  });
});
