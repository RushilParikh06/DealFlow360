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

export const staticRoutes: { slug: string[]; page: PageName }[] = [
  { slug: ["login"], page: "login" },
  { slug: ["signup"], page: "login" },
  { slug: ["dashboard"], page: "dashboard" },
  { slug: ["quotations"], page: "quotations" },
  { slug: ["quotations", "Q-1042"], page: "quotation-detail" },
  { slug: ["approvals"], page: "approvals" },
  { slug: ["approvals", "Q-1042"], page: "approval-detail" },
  { slug: ["fulfillment"], page: "fulfillment" },
  { slug: ["fulfillment", "ORD-2291"], page: "warehouse-allocation" },
  { slug: ["subscriptions"], page: "subscriptions" },
  { slug: ["subscriptions", "SUB-4012"], page: "subscription-billing" },
  { slug: ["invoices"], page: "invoices" },
  { slug: ["invoices", "INV-1042"], page: "invoice-detail" },
  { slug: ["deal-health"], page: "deal-health" },
  { slug: ["admin", "reports"], page: "reports" },
  { slug: ["portal", "quotations", "Q-1042"], page: "customer-quotation" },
];

export function resolvePage(slug: string[]): PageName | undefined {
  return staticRoutes.find((route) => route.slug.join("/") === slug.join("/"))?.page;
}
