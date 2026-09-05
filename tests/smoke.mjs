import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pages = [
  "login", "dashboard", "quotations", "quotation-detail", "approvals",
  "approval-detail", "fulfillment", "warehouse-allocation", "subscriptions",
  "subscription-billing", "invoices", "invoice-detail", "deal-health",
  "reports", "customer-quotation"
];

for (const page of pages) {
  const html = readFileSync(new URL(`../pages/${page}.html`, import.meta.url), "utf8");
  assert.match(html, /<body[^>]*>/);
}

const packageJson = JSON.parse(readFileSync(new URL("../apps/web/package.json", import.meta.url), "utf8"));
assert.deepEqual(
  ["next", "react", "react-dom"].filter((dependency) => !packageJson.dependencies[dependency]),
  []
);

const routeSource = readFileSync(new URL("../apps/web/lib/routes.ts", import.meta.url), "utf8");
for (const page of pages) assert.match(routeSource, new RegExp(`"${page}"`));

console.log(`DealFlow360 Next.js smoke check passed: ${pages.length} pages.`);
