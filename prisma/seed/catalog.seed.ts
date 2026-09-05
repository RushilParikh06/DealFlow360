// B3-owned seed data (plan.md section 3). `run` takes a duck-typed Prisma
// client so this stays wired to prisma/seed/index.ts (group-owned) once that
// exists, without needing @prisma/client installed to write or check the data.

export const categories = [
  { id: 'cat_hardware', name: 'Hardware' },
  { id: 'cat_services', name: 'Services' },
];

export const products = [
  { id: 'prd_1', categoryId: 'cat_hardware', name: 'Laptop', sku: 'LAP-14', costMinor: 60000, currency: 'INR' },
  { id: 'prd_9', categoryId: 'cat_services', name: 'Onsite Setup Service', sku: 'SVC-SETUP', costMinor: 10000, currency: 'INR' },
];

export const warehouses = [
  { id: 'wh_main', name: 'Main Warehouse', shippingCostMinor: 4200, currency: 'INR' },
  { id: 'wh_east', name: 'East Depot', shippingCostMinor: 2900, currency: 'INR' },
];

export const inventory = [
  { warehouseId: 'wh_main', productId: 'prd_1', onHand: 30, reserved: 0 },
  { warehouseId: 'wh_east', productId: 'prd_1', onHand: 5, reserved: 0 },
];

/** Catches a seed row pointing at a category/product id that doesn't exist. */
export function validateCatalogSeed(): string[] {
  const categoryIds = new Set(categories.map((c) => c.id));
  const productIds = new Set(products.map((p) => p.id));
  const errors: string[] = [];

  for (const p of products) if (!categoryIds.has(p.categoryId)) errors.push(`product ${p.id} references unknown category ${p.categoryId}`);
  for (const i of inventory) if (!productIds.has(i.productId)) errors.push(`inventory row references unknown product ${i.productId}`);
  return errors;
}

interface SeedClient {
  category: { createMany(args: { data: unknown[] }): Promise<unknown> };
  product: { createMany(args: { data: unknown[] }): Promise<unknown> };
  warehouse: { createMany(args: { data: unknown[] }): Promise<unknown> };
  inventory: { createMany(args: { data: unknown[] }): Promise<unknown> };
}

export async function run(prisma: SeedClient): Promise<void> {
  await prisma.category.createMany({ data: categories });
  await prisma.product.createMany({ data: products });
  await prisma.warehouse.createMany({ data: warehouses });
  await prisma.inventory.createMany({ data: inventory });
}
