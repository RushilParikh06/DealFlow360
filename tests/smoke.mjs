import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const pages = [
  "login", "dashboard", "quotations", "quotation-detail", "approvals",
  "approval-detail", "fulfillment", "warehouse-allocation", "subscriptions",
  "subscription-billing", "invoices", "invoice-detail", "deal-health",
  "reports", "customer-quotation"
];

for (const page of pages) assert.match(read(`../pages/${page}.html`), /<body[^>]*>/);

const packageJson = JSON.parse(read("../apps/web/package.json"));
assert.deepEqual(
  ["next", "react", "react-dom", "@dealflow/contracts"].filter((d) => !packageJson.dependencies[d]),
  []
);

const routeSource = read("../apps/web/lib/routes.ts");
for (const page of pages) assert.match(routeSource, new RegExp(`"${page}"`));

// --- frontend <-> backend wiring -------------------------------------------
// The frontend is a static export calling the API from the browser, so nothing
// at build time would notice B1/B2 renaming a route. This check does.

const live = read("../apps/web/lib/live.ts");
const api = read("../apps/web/lib/api.ts");
assert.match(read("../apps/web/components/page-client.tsx"), /goLive\(root, page\)/,
  "the page shell must hand every page to lib/live.ts");
assert.match(live, /clearDemoData\(root\)/, "pages must clear structural placeholder records");
assert.match(read("../apps/web/app/globals.css"), /tbody:not\(\[data-live\]\)/,
  "structural table rows must stay hidden before hydration");
assert.doesNotMatch(`${api}\n${live}\n${read("../.env.example")}`, /USE_MOCKS/);
for (const fixture of ["intelligence.ts", "intelligence-fixtures.json"]) {
  assert.equal(existsSync(new URL(`../apps/web/src/mocks/${fixture}`, import.meta.url)), false,
    `unused frontend fixture ${fixture} should not return`);
}

const controllersDir = new URL("../apps/api/src/modules/", import.meta.url);
const routes = new Set();
for (const module of readdirSync(controllersDir)) {
  let files = [];
  try {
    files = readdirSync(new URL(`${module}/controllers/`, controllersDir));
  } catch {
    continue; // operations/ and billing/ are engine-only, no controllers yet
  }
  for (const file of files) {
    const source = readFileSync(new URL(`${module}/controllers/${file}`, controllersDir), "utf8");
    const prefix = source.match(/@Controller\('([^']*)'\)|@Controller\(\)/);
    const base = prefix?.[1] ?? "";
    for (const [, path] of source.matchAll(/@(?:Get|Post|Patch|Delete)\('?([^')]*)'?\)/g)) {
      routes.add(`/${[base, path].filter(Boolean).join("/")}`);
    }
  }
}

// Every literal path lib/live.ts fetches, minus its query string.
const called = [...live.matchAll(/api\.(?:get|post|patch|del)<.*?>\("(\/[^"?]*)/g)].map((m) => m[1]);
assert.ok(called.length > 0, "lib/live.ts calls no endpoints - the wiring is gone");

for (const path of called) {
  assert.ok(routes.has(path), `lib/live.ts calls ${path}, which no controller serves`);
}

// The auth calls live in lib/api.ts, not lib/live.ts.
for (const path of ["/auth/login", "/auth/signup", "/auth/refresh"]) {
  assert.ok(routes.has(path), `lib/api.ts depends on ${path}`);
  assert.match(api, new RegExp(`"${path}"`));
}

console.log(
  `DealFlow360 smoke check passed: ${pages.length} pages, ${routes.size} API routes, ` +
  `${called.length} live bindings.`
);
