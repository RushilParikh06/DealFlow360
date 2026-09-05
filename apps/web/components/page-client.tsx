"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { goLive } from "@/lib/live";
import { wireAccessibility } from "@/lib/ui";
import type { PageName } from "@/lib/routes";

const routes = {
  login: "/login/",
  dashboard: "/dashboard/",
  quotations: "/quotations/",
  approvals: "/approvals/",
  fulfillment: "/fulfillment/",
  subscriptions: "/subscriptions/",
  invoices: "/invoices/",
  "deal-health": "/deal-health/",
  "admin-reports": "/admin/reports/",
  quote: "/quotations/Q-1042/",
  approval: "/approvals/Q-1042/",
  allocation: "/fulfillment/ORD-2291/",
  billing: "/subscriptions/SUB-4012/",
  invoice: "/invoices/INV-1042/",
  portal: "/portal/quotations/Q-1042/",
} as const;

const text = (element: Element) => {
  const copy = element.cloneNode(true) as Element;
  copy.querySelectorAll(".material-symbols-outlined").forEach(icon => icon.remove());
  return copy.textContent?.replace(/\s+/g, " ").trim() ?? "";
};
const go = (route: keyof typeof routes) => window.location.assign(routes[route]);

function wireNavigation(root: HTMLElement, page: PageName) {
  const nav = root.querySelector<HTMLElement>(":scope > header nav");
  if (!nav) return;

  const activePath = [
    [/^dashboard$/, "dashboard"],
    [/^quotation/, "quotations"],
    [/^approval/, "approvals"],
    [/^fulfillment$|^warehouse-/, "fulfillment"],
    [/^subscriptions$|^subscription-/, "subscriptions"],
    [/^invoices$|^invoice-/, "invoices"],
    [/^deal-health$/, "deal-health"],
    [/^reports$/, "admin-reports"],
  ].find(([pattern]) => (pattern as RegExp).test(page))?.[1] as keyof typeof routes | undefined;

  nav.querySelectorAll<HTMLAnchorElement>("a").forEach((link) => {
    const path = (link.dataset.path ?? text(link).toLowerCase().replace("deal health", "deal-health").replace("reports", "admin-reports")) as keyof typeof routes;
    if (!routes[path]) return;
    link.dataset.path = path;
    link.href = routes[path];
    if (path === activePath) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  const button = document.createElement("button");
  button.className = "df-menu-button";
  button.type = "button";
  button.setAttribute("aria-label", "Open application navigation");
  button.setAttribute("aria-expanded", "false");
  button.textContent = "☰";

  const mobileNav = nav.cloneNode(true) as HTMLElement;
  mobileNav.className = "df-mobile-nav";
  mobileNav.id = "application-navigation";
  mobileNav.setAttribute("aria-label", "Application navigation");
  button.setAttribute("aria-controls", mobileNav.id);
  mobileNav.removeAttribute("data-active-classes");
  mobileNav.dataset.open = "false";
  const setOpen = (open: boolean) => {
    mobileNav.dataset.open = String(open);
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", `${open ? "Close" : "Open"} application navigation`);
    button.textContent = open ? "×" : "☰";
  };
  button.addEventListener("click", () => setOpen(mobileNav.dataset.open !== "true"));
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && mobileNav.dataset.open === "true") {
      setOpen(false);
      button.focus();
    }
  });
  root.addEventListener("click", (event) => {
    if (!mobileNav.contains(event.target as Node) && !button.contains(event.target as Node)) setOpen(false);
  });

  nav.after(button);
  root.querySelector(":scope > header")?.append(mobileNav);
}

function wireBrandLogo(root: HTMLElement) {
  root.querySelectorAll<HTMLImageElement>('img[alt*="DealFlow360"]').forEach((image) => {
    image.src = "/assets/logo.svg";
    image.alt = "DealFlow360 logo";
  });
}

function wirePageRoutes(root: HTMLElement, page: PageName) {
  const rules: [RegExp, RegExp, keyof typeof routes][] = [
    [/dashboard/, /New Quotation/, "quote"],
    [/dashboard/, /Browse (active ledger|quotations)/i, "quotations"],
    [/dashboard/, /Review approvals|^Approvals 3 PENDING$/i, "approvals"],
    [/dashboard/, /Open Deal Health/i, "deal-health"],
    [/dashboard/, /^Q-1042$|Verify Line Items/, "approval"],
    [/dashboard/, /Approve Split/, "allocation"],
    [/^quotations$/, /^Q-1042$|New Quotation/, "quote"],
    [/quotation-detail/, /Preview Customer View/, "portal"],
    [/quotation-detail/, /Submit for Approval/, "approval"],
    [/^approvals$/, /^Q-1042$|Review & Sign-off/, "approval"],
    [/approval-detail/, /^Approvals$/, "approvals"],
    [/^fulfillment$/, /Review Split|View Allocation/, "allocation"],
    [/warehouse-allocation/, /^Fulfillment$/, "fulfillment"],
    [/^subscriptions$/, /^SUB-4012/, "billing"],
    [/subscription-billing/, /^Subscriptions$/, "subscriptions"],
    [/subscription-billing/, /^Q-1042 Enterprise Rev$/, "quote"],
    [/^invoices$/, /View Detail/, "invoice"],
    [/invoice-detail/, /^Invoices$/, "invoices"],
    [/deal-health/, /Review Concession|Audit Trail/, "approval"],
    [/deal-health/, /Reallocate Depot/, "allocation"],
  ];

  root.querySelectorAll<HTMLElement>("a, button").forEach((element) => {
    const match = rules.find(([pagePattern, textPattern]) => pagePattern.test(page) && textPattern.test(text(element)));
    if (!match) return;
    if (element.tagName === "A") {
      element.setAttribute("href", routes[match[2]]);
      return;
    }
    element.addEventListener("click", (event) => {
      event.preventDefault();
      go(match[2]);
    });
  });
}

function wirePortal(root: HTMLElement, page: PageName) {
  if (page !== "customer-quotation") return;
  root.querySelectorAll<HTMLAnchorElement>(":scope > main header a").forEach((element) => {
    if (text(element).includes("My Quotation")) element.href = "#main-content";
    if (text(element).includes("Messages")) element.href = "#dynamicMessages";
    if (text(element).includes("Profile")) element.href = "#portal-profile";
  });
}

type Props = {
  bodyClass: string;
  html: string;
  page: PageName;
  scripts: string[];
  theme: Record<string, string>;
};

export function PageClient({ bodyClass, html, page, scripts, theme }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (root.dataset.wired === "true") return wireAccessibility(root);
    root.dataset.wired = "true";

    scripts.forEach((script) => window.eval(script));
    wireBrandLogo(root);
    wireNavigation(root, page);
    wirePageRoutes(root, page);
    wirePortal(root, page);
    document.dispatchEvent(new Event("DOMContentLoaded"));
    const cleanup = wireAccessibility(root);
    // Sign-in and connected records. Must run last: it reads
    // the DOM the eval'd page scripts just finished building.
    goLive(root, page);
    return cleanup;
  }, [page, scripts]);

  return (
    <div
      ref={rootRef}
      data-page-root
      data-page={page}
      className={bodyClass}
      style={theme as CSSProperties}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
