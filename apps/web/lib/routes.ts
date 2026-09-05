export const pageNames = [
  "login",
  "dashboard",
  "quotations",
  "quotation-detail",
  "approvals",
  "approval-detail",
  "fulfillment",
  "warehouse-allocation",
  "subscriptions",
  "subscription-billing",
  "invoices",
  "invoice-detail",
  "deal-health",
  "reports",
  "customer-quotation",
] as const;

export type PageName = (typeof pageNames)[number];

/**
 * Route patterns, most specific first. A ":id" segment matches any single
 * segment and is handed to the page binder, so /quotations/<any quote id>/
 * renders the detail template for that record instead of 404ing on everything
 * except the one demo code that happened to be prebuilt.
 */
const patterns: { slug: string[]; page: PageName }[] = [
  { slug: ["login"], page: "login" },
  { slug: ["signup"], page: "login" },
  { slug: ["dashboard"], page: "dashboard" },
  { slug: ["quotations"], page: "quotations" },
  { slug: ["quotations", ":id"], page: "quotation-detail" },
  { slug: ["approvals"], page: "approvals" },
  { slug: ["approvals", ":id"], page: "approval-detail" },
  { slug: ["fulfillment"], page: "fulfillment" },
  { slug: ["fulfillment", ":id"], page: "warehouse-allocation" },
  { slug: ["subscriptions"], page: "subscriptions" },
  { slug: ["subscriptions", ":id"], page: "subscription-billing" },
  { slug: ["invoices"], page: "invoices" },
  { slug: ["invoices", ":id"], page: "invoice-detail" },
  { slug: ["deal-health"], page: "deal-health" },
  { slug: ["admin", "reports"], page: "reports" },
  { slug: ["portal", "quotations", ":id"], page: "customer-quotation" },
];

const SAMPLE_ID: Partial<Record<PageName, string>> = {
  "quotation-detail": "Q-1042",
  "approval-detail": "Q-1042",
  "warehouse-allocation": "ORD-2291",
  "subscription-billing": "SUB-4012",
  "invoice-detail": "INV-1042",
  "customer-quotation": "Q-1042",
};

/**
 * The routes prerendered at build time. Everything else with a matching shape
 * is rendered on demand, so a record created during the demo is reachable.
 */
export const staticRoutes: { slug: string[]; page: PageName }[] = patterns.map(({ slug, page }) => ({
  slug: slug.map((segment) => (segment === ":id" ? (SAMPLE_ID[page] ?? "sample") : segment)),
  page,
}));

const match = (slug: string[]) =>
  patterns.find(
    (pattern) =>
      pattern.slug.length === slug.length &&
      pattern.slug.every((segment, index) => segment === ":id" || segment === slug[index]),
  );

export function resolvePage(slug: string[]): PageName | undefined {
  return match(slug)?.page;
}

/** The record id a detail route was opened for, or undefined for list pages. */
export function resolveRecordId(slug: string[]): string | undefined {
  const pattern = match(slug);
  const index = pattern?.slug.indexOf(":id") ?? -1;
  return index === -1 ? undefined : slug[index];
}

/** Client-side equivalent, for binders that only have window.location. */
export function recordIdFromPath(pathname: string): string | undefined {
  return resolveRecordId(pathname.split("/").filter(Boolean));
}
