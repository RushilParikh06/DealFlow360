// F owned. Binds each designed page to the endpoints that actually exist.

import { api, auth, isSignedIn, saveTokens, type Paginated } from "./api";
import { clearDemoData, fillTable, money, relative, shortDate, showBanner, titleCase } from "./dom";
import type { PageName } from "./routes";

type Quotation = {
  id: string;
  code: string;
  status: string;
  currency: string;
  discountMinor: number;
  totalMinor: number;
  ownerUserId: string;
  validUntil: string | null;
  lastActivityAt: string;
  customer: { name: string; tier: { code: string } | null } | null;
};

type Approval = {
  id: string;
  quotationCode: string;
  customerName: string;
  status: string;
  currentStep: string | null;
  riskScore: number;
  riskLevel: string;
  total: { amountMinor: number; currency: string };
  createdAt: string;
};

type Order = {
  id: string;
  code: string;
  status: string;
  currency: string;
  totalMinor: number;
  createdAt: string;
  quotation?: { customer?: { name: string } | null } | null;
  _count?: { lines: number };
};

type DealHealth = {
  id: string;
  quotationCode: string;
  customerName: string;
  type: string;
  severity: string;
  message: string;
  detectedAt: string;
};

const tbodies = (root: HTMLElement): HTMLElement[] => [...root.querySelectorAll<HTMLElement>("tbody")];

async function bindQuotations(root: HTMLElement): Promise<void> {
  const [tbody] = tbodies(root);
  if (!tbody) return;

  const page = await api.get<Paginated<Quotation>>("/quotes?pageSize=25");
  fillTable(tbody, page.items, (quote) => ({
    0: quote.code,
    1: quote.customer?.name ?? "—",
    2: quote.ownerUserId,
    3: money(quote.totalMinor, quote.currency),
    4: quote.discountMinor > 0 ? `Discount ${money(quote.discountMinor, quote.currency)}` : "At list price",
    5: titleCase(quote.status),
    6: shortDate(quote.validUntil),
    7: relative(quote.lastActivityAt),
  }));
}

async function bindApprovals(root: HTMLElement): Promise<void> {
  const [tbody] = tbodies(root);
  if (!tbody) return;

  const page = await api.get<Paginated<Approval>>("/approvals?pageSize=25");
  fillTable(tbody, page.items, (approval) => ({
    0: approval.quotationCode,
    1: approval.customerName,
    2: `${approval.riskLevel} · ${approval.riskScore}`,
    3: money(approval.total.amountMinor, approval.total.currency),
    4: approval.currentStep ? titleCase(approval.currentStep) : "—",
    5: relative(approval.createdAt),
  }));
}

/** Only the second table (orders) is live; the first is the inventory grid. */
async function bindFulfillment(root: HTMLElement): Promise<void> {
  const tbody = tbodies(root)[1];
  if (!tbody) return;

  const page = await api.get<Paginated<Order>>("/orders?pageSize=25");
  fillTable(tbody, page.items, (order) => ({
    0: order.code,
    1: order.quotation?.customer?.name ?? "—",
    2: `${order._count?.lines ?? 0} lines · ${money(order.totalMinor, order.currency)}`,
    6: titleCase(order.status),
  }));
}

async function bindDealHealth(root: HTMLElement): Promise<void> {
  const [tbody] = tbodies(root);
  if (!tbody) return;

  const items = await api.get<DealHealth[]>("/deal-health");
  fillTable(tbody, items, (item) => ({
    0: item.quotationCode,
    1: item.customerName,
    2: item.message,
    3: titleCase(item.severity),
    5: relative(item.detectedAt),
  }));
}

/**
 * Replaces the page's own `simulateAuth()` with a real token exchange. The
 * designed markup already carries the tab state and the role cards; we read
 * them rather than re-render.
 */
function bindLogin(root: HTMLElement): void {
  const form = root.querySelector<HTMLFormElement>("#auth-form");
  const email = root.querySelector<HTMLInputElement>("#work-email");
  const password = root.querySelector<HTMLInputElement>("#password-input");
  const submit = root.querySelector<HTMLButtonElement>("#submit-btn");
  if (!form || !email || !password || !submit) return;

  // The page ships with inline `onsubmit="...simulateAuth()"`. That handler was
  // registered when the markup was parsed, so stopping propagation later is too
  // late - the attribute itself has to go.
  form.removeAttribute("onsubmit");
  form.onsubmit = null;

  let mode: "signin" | "signup" = "signin";
  root.querySelector("#tab-signin")?.addEventListener("click", () => (mode = "signin"));
  root.querySelector("#tab-signup")?.addEventListener("click", () => (mode = "signup"));

  let portal = false;
  root.querySelector("#role-internal")?.addEventListener("click", () => (portal = false));
  root.querySelector("#role-customer")?.addEventListener("click", () => (portal = true));

  const label = submit.querySelector("span");
  const say = (text: string) => {
    if (label) label.textContent = text;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!email.value || !password.value) return say("EMAIL AND PASSWORD REQUIRED");

    submit.disabled = true;
    say("VERIFYING CREDENTIALS...");
    try {
      const name = email.value.split("@")[0];
      saveTokens(
        mode === "signup"
          ? await auth.signup(email.value, name, password.value)
          : await auth.login(email.value, password.value),
      );
      say("AUTHENTICATED // ROUTING");
      window.location.assign(portal ? "/portal/quotations/Q-1042/" : "/dashboard/");
    } catch (error) {
      submit.disabled = false;
      say((error as Error).message.toUpperCase().slice(0, 48));
    }
  });
}

const BINDERS: Partial<Record<PageName, (root: HTMLElement) => void | Promise<void>>> = {
  login: bindLogin,
  quotations: bindQuotations,
  approvals: bindApprovals,
  fulfillment: bindFulfillment,
  "deal-health": bindDealHealth,
};

export function goLive(root: HTMLElement, page: PageName): void {
  clearDemoData(root);

  const bind = BINDERS[page];
  if (!bind) return;

  if (page !== "login" && !isSignedIn()) {
    return showBanner(root, "Sign in to load live records.", "info");
  }

  void Promise.resolve(bind(root)).catch((error: Error) =>
    showBanner(root, `API unavailable (${error.message})`),
  );
}
