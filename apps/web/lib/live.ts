// F owned. Binds each designed page to the endpoints that actually exist.

import { api, auth, isSignedIn, saveTokens, type Paginated } from "./api";
import { clearDemoData, fillTable, money, relative, shortDate, showBanner, showTableState, titleCase } from "./dom";
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

function tableControls<T>(root: HTMLElement, tbody: HTMLElement, result: Paginated<T>, load: (page: number) => Promise<void>) {
  const rows = result.items.length ? [...tbody.children] as HTMLElement[] : [];
  const search = root.querySelector<HTMLInputElement>('main input[placeholder*="Search"], main input[placeholder*="Filter quote"]');
  if (search) {
    search.disabled = false;
    search.removeAttribute("title");
    search.placeholder = "Search this page of records…";
    search.setAttribute("aria-label", "Search this page of records");
    search.oninput = () => {
      const query = search.value.trim().toLowerCase();
      const matches = rows.filter(row => row.textContent?.toLowerCase().includes(query));
      if (matches.length) tbody.replaceChildren(...matches);
      else showTableState(tbody, "No matching records on this page.");
    };
    search.oninput(new Event("input"));
  }
  // Replace the sample pagination with the server's actual page/count metadata.
  const count = [...root.querySelectorAll<HTMLElement>("[data-record-count]")].find(node => node.dataset.recordCount === tbody.closest("table")?.id);
  let footer = root.querySelector<HTMLElement>("[data-pagination]") ?? count?.parentElement;
  while (footer && !footer.querySelector("button")) footer = footer.parentElement;
  if (!footer || footer.contains(tbody)) return;
  const label = document.createElement("span");
  label.textContent = `${result.items.length} of ${result.total} records · Page ${result.page}`;
  label.setAttribute("role", "status");
  const controls = [document.createElement("button"), document.createElement("button")];
  controls.forEach((button, index) => {
    button.type = "button";
    button.textContent = index ? "Next" : "Prev";
    button.className = "border border-outline bg-surface-container-lowest px-space-sm py-space-xs";
    button.disabled = index ? result.page * result.pageSize >= result.total : result.page <= 1;
    button.onclick = async () => {
      controls.forEach(control => { control.disabled = true; });
      tbody.setAttribute("aria-busy", "true");
      try { await load(result.page + (index ? 1 : -1)); }
      catch (error) { showBanner(root, (error as Error).message); }
      finally {
        tbody.setAttribute("aria-busy", "false");
        controls[0].disabled = result.page <= 1;
        controls[1].disabled = result.page * result.pageSize >= result.total;
      }
    };
  });
  footer.dataset.pagination = "true";
  footer.replaceChildren(controls[0], label, controls[1]);
}

async function bindQuotations(root: HTMLElement, pageNumber = 1): Promise<void> {
  const [tbody] = tbodies(root);
  if (!tbody) return;

  const page = await api.get<Paginated<Quotation>>(`/quotes?pageSize=25&page=${pageNumber}`);
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
  tableControls(root, tbody, page, next => bindQuotations(root, next));
}

async function bindApprovals(root: HTMLElement, pageNumber = 1): Promise<void> {
  const [tbody] = tbodies(root);
  if (!tbody) return;

  const page = await api.get<Paginated<Approval>>(`/approvals?pageSize=25&page=${pageNumber}`);
  fillTable(tbody, page.items, (approval) => ({
    1: approval.quotationCode,
    2: approval.customerName,
    3: `${approval.riskLevel} · ${approval.riskScore}`,
    4: "—",
    5: approval.currentStep ? titleCase(approval.currentStep) : "—",
    6: `Created ${relative(approval.createdAt)}`,
  }));
  tableControls(root, tbody, page, next => bindApprovals(root, next));
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
  tableControls(root, tbody, { items, total: items.length, page: 1, pageSize: items.length || 1 }, () => bindDealHealth(root));
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

  let mode: "signin" | "signup" = window.location.pathname.startsWith("/signup") ? "signup" : "signin";
  root.querySelector("#tab-signin")?.addEventListener("click", () => (mode = "signin"));
  root.querySelector("#tab-signup")?.addEventListener("click", () => (mode = "signup"));
  if (mode === "signup") root.querySelector<HTMLButtonElement>("#tab-signup")?.click();

  let portal = false;
  root.querySelector("#role-internal")?.addEventListener("click", () => (portal = false));
  root.querySelector("#role-customer")?.addEventListener("click", () => (portal = true));

  const label = submit.querySelector("span");
  const say = (text: string) => {
    if (label) label.textContent = text;
  };
  const feedback = document.createElement("p");
  feedback.id = "auth-feedback";
  feedback.setAttribute("role", "alert");
  feedback.className = "text-error text-body-md";
  form.append(feedback);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!email.value || !password.value) return say("EMAIL AND PASSWORD REQUIRED");

    submit.disabled = true;
    feedback.textContent = "";
    form.setAttribute("aria-busy", "true");
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
      say(mode === "signup" ? "Sign Up" : "Sign In");
      feedback.textContent = (error as Error).message;
    } finally {
      form.setAttribute("aria-busy", "false");
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
  if (page !== "login") {
    for (const control of root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('main select, main input[placeholder*="Search"], main input[placeholder*="Filter"]')) {
      control.disabled = true;
      control.title = "This control is not connected to live records yet.";
    }
  }

  const bind = BINDERS[page];
  if (!bind) return;

  if (page !== "login" && !isSignedIn()) {
    return showBanner(root, "Sign in to load records. Summary figures are preview examples.", "info");
  }

  if (page !== "login") {
    root.setAttribute("aria-busy", "true");
    (page === "fulfillment" ? tbodies(root).slice(1) : tbodies(root)).forEach(tbody => showTableState(tbody, "Loading records…"));
  }
  void Promise.resolve(bind(root)).catch((error: Error) => {
    tbodies(root).forEach(tbody => showTableState(tbody, "Records could not be loaded."));
    showBanner(root, error.message);
  }).finally(() => root.setAttribute("aria-busy", "false"));
}
