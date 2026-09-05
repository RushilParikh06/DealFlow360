// F owned. Binds each designed page to the endpoints that actually exist.
//
// Pages the API cannot serve yet keep their sample rows on purpose - see
// LIVE_PAGES below. Everything here runs in the browser after the static
// export has already painted, so a slow or down API costs a banner, not a
// blank screen.

import { api, auth, clearTokens, isSignedIn, saveTokens, USE_MOCKS, type Paginated } from "./api";
import { fillTable, money, relative, shortDate, showBanner, titleCase } from "./dom";
import type { PageName } from "./routes";

type Quotation = {
  id: string;
  code: string;
  status: string;
  currency: string;
  discountMinor: number;
  totalMinor: number;
  ownerUserId: string;
  ownerName: string;
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

type InventoryRow = {
  id: string;
  sku: string;
  productName: string;
  warehouseCode: string;
  warehouseName: string;
  onHand: number;
  reserved: number;
  available: number;
};

type Invoice = {
  id: string;
  orderId: string;
  status: string;
  totalMinor: number;
  paidMinor: number;
  currency: string;
  createdAt: string;
  _count?: { lines: number };
};

type Subscription = {
  id: string;
  orderId: string;
  status: string;
  amountMinor: number;
  currency: string;
  cadenceMonths: number;
  schedules?: { dueAt: string }[];
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

/** Pages wired to a real endpoint. */
const LIVE_PAGES: PageName[] = [
  "login",
  "quotations",
  "approvals",
  "fulfillment",
  "deal-health",
  "invoices",
  "subscriptions",
];

const tbodies = (root: HTMLElement): HTMLElement[] => [...root.querySelectorAll<HTMLElement>("tbody")];

async function bindQuotations(root: HTMLElement): Promise<void> {
  const [tbody] = tbodies(root);
  if (!tbody) return;

  const page = await api.get<Paginated<Quotation>>("/quotes?pageSize=25");
  fillTable(tbody, page.items, (quote) => ({
    0: quote.code,
    1: quote.customer?.name ?? "—",
    2: quote.ownerName,
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

/** Two tables: the warehouse stock grid, then the orders awaiting dispatch. */
async function bindFulfillment(root: HTMLElement): Promise<void> {
  const [stock, orders] = tbodies(root);

  if (stock) {
    const inventory = await api.get<Paginated<InventoryRow>>("/inventory?pageSize=50");
    fillTable(
      stock,
      inventory.items,
      (row) => ({
        0: [row.productName, `SKU: ${row.sku}`],
        1: row.warehouseName,
        2: String(row.onHand),
        3: String(row.reserved),
        4: String(row.available),
        // [5] is the reorder point, which no table stores yet - the sample
        // value stays rather than being invented here.
        6: row.available > 0 ? "IN STOCK" : "OUT OF STOCK",
      }),
      // The page's own filter script reads these attributes off the row.
      (element, row) => {
        element.dataset.depot = row.warehouseName;
        element.dataset.sku = row.sku;
      },
    );
  }

  if (orders) {
    const page = await api.get<Paginated<Order>>("/orders?pageSize=25");
    fillTable(orders, page.items, (order) => ({
      0: order.code,
      1: order.quotation?.customer?.name ?? "—",
      2: [`${order._count?.lines ?? 0} lines`, money(order.totalMinor, order.currency)],
      6: titleCase(order.status),
    }));
  }
}

async function bindInvoices(root: HTMLElement): Promise<void> {
  const [tbody] = tbodies(root);
  if (!tbody) return;

  const page = await api.get<Paginated<Invoice>>("/invoices?pageSize=25");
  fillTable(tbody, page.items, (invoice) => ({
    1: invoice.id,
    3: invoice.orderId,
    4: `${invoice._count?.lines ?? 0} one-time lines`,
    5: [
      money(invoice.totalMinor, invoice.currency),
      `Paid ${money(invoice.paidMinor, invoice.currency)}`,
    ],
    6: titleCase(invoice.status),
    7: shortDate(invoice.createdAt),
  }));
}

async function bindSubscriptions(root: HTMLElement): Promise<void> {
  const [tbody] = tbodies(root);
  if (!tbody) return;

  const page = await api.get<Paginated<Subscription>>("/subscriptions?pageSize=25");
  fillTable(tbody, page.items, (subscription) => ({
    1: subscription.id,
    3: subscription.orderId,
    4: subscription.cadenceMonths === 1 ? "Monthly" : `Every ${subscription.cadenceMonths} months`,
    5: shortDate(subscription.schedules?.[0]?.dueAt),
    6: money(subscription.amountMinor, subscription.currency),
    7: titleCase(subscription.status),
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
 * Every internal page has a profile avatar in its header and nothing else about
 * the session: signed in and signed out looked identical, which is why a
 * successful login read as "nothing happened". This puts the account and a way
 * out next to that avatar, on every page.
 */
async function mountSession(root: HTMLElement): Promise<void> {
  const avatar = root.querySelector("img[alt='Profile']");
  const anchor = avatar?.parentElement;
  if (!anchor || anchor.querySelector("[data-df-session]")) return;

  const box = document.createElement("div");
  box.dataset.dfSession = "true";
  // shrink-0 + nowrap: these headers are packed flex rows with no slack, and a
  // wrapping control pushes itself off the right edge of the page.
  box.className = "flex items-center gap-space-xxs pl-space-xxs shrink-0 whitespace-nowrap";
  anchor.appendChild(box);

  const who = await auth.me();

  if (!who) {
    const link = document.createElement("a");
    link.href = "/login/";
    link.className =
      "font-mono-metric-sm text-mono-metric-sm uppercase tracking-wider px-2 py-1 border border-outline bg-primary text-on-primary";
    link.textContent = "Sign in";
    box.appendChild(link);
    return;
  }

  // The name only appears where the header has room for it; the icon button and
  // its tooltip carry the same information everywhere else.
  const name = document.createElement("div");
  name.className = "hidden 2xl:flex flex-col leading-tight max-w-[140px] overflow-hidden";
  const person = document.createElement("span");
  person.className = "font-label-sm text-label-sm font-semibold text-on-surface truncate";
  person.textContent = who.name; // from the database - never innerHTML
  const role = document.createElement("span");
  role.className = "font-mono-metric-sm text-mono-metric-sm text-on-surface-variant uppercase truncate";
  role.textContent = who.role.replace(/_/g, " ");
  name.append(person, role);

  const out = document.createElement("button");
  out.type = "button";
  out.title = `Signed in as ${who.name} (${who.role.replace(/_/g, " ")}) - sign out`;
  out.setAttribute("aria-label", out.title);
  out.className =
    "shrink-0 p-1.5 border-[1.5px] border-outline bg-surface hover:bg-surface-dim text-on-surface transition-colors";
  out.innerHTML = '<span class="material-symbols-outlined text-[18px]">logout</span>';
  out.addEventListener("click", () => {
    clearTokens();
    window.location.assign("/login/");
  });

  // The decorative avatar now stands for a real account.
  if (avatar) (avatar as HTMLImageElement).title = out.title;

  box.append(name, out);
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

  // The sample password is a row of bullet characters, not a credential.
  if (/^[•\s]*$/.test(password.value)) password.value = "";

  const label = submit.querySelector("span");
  const say = (text: string) => {
    if (label) label.textContent = text;
  };

  // Landing here with a valid session is otherwise a dead end - the form gives
  // no hint that signing in already happened.
  if (isSignedIn()) {
    void auth.me().then((who) => {
      if (who) say(`ALREADY SIGNED IN AS ${who.name.toUpperCase()} — CONTINUE`);
    });
  }

  let mode: "signin" | "signup" = "signin";
  root.querySelector("#tab-signin")?.addEventListener("click", () => (mode = "signin"));
  root.querySelector("#tab-signup")?.addEventListener("click", () => (mode = "signup"));

  let portal = false;
  root.querySelector("#role-internal")?.addEventListener("click", () => (portal = false));
  root.querySelector("#role-customer")?.addEventListener("click", () => (portal = true));

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
      // The button is the only place this screen can speak, so keep it short
      // enough to read at a glance and specific enough to act on.
      const code = (error as { code?: string }).code;
      say(
        code === "API_UNREACHABLE"
          ? "API NOT RUNNING — START IT ON :3001"
          : code === "UNAUTHENTICATED"
            ? "INVALID EMAIL OR PASSWORD"
            : (error as Error).message.toUpperCase().slice(0, 44),
      );
    }
  });
}

const BINDERS: Partial<Record<PageName, (root: HTMLElement) => void | Promise<void>>> = {
  login: bindLogin,
  quotations: bindQuotations,
  approvals: bindApprovals,
  fulfillment: bindFulfillment,
  "deal-health": bindDealHealth,
  invoices: bindInvoices,
  subscriptions: bindSubscriptions,
};

export function goLive(root: HTMLElement, page: PageName): void {
  if (USE_MOCKS) return;

  // Runs everywhere: an unbound page still has to say who is signed in.
  if (page !== "login") void mountSession(root).catch(() => {});

  if (!LIVE_PAGES.includes(page)) return;

  const bind = BINDERS[page];
  if (!bind) return;

  // Every live page but login needs a token; without one the sample rows are
  // still the most useful thing to show.
  if (page !== "login" && !isSignedIn()) {
    return showBanner(root, "Sample data — sign in to load live records.", "info");
  }

  void Promise.resolve(bind(root)).catch((error: Error) =>
    showBanner(root, `Sample data — API unavailable (${error.message})`),
  );
}
