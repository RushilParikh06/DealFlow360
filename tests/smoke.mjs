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
  assert.match(html, /\.\.\/assets\/css\/app\.css/);
  assert.match(html, /\.\.\/assets\/js\/app\.js/);
}

const portal = readFileSync(new URL("../pages/customer-quotation.html", import.meta.url), "utf8");
assert.match(portal, /<html class="portal-page"/);

console.log(`DealFlow360 smoke check passed: ${pages.length} pages.`);
