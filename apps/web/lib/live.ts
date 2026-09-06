// F owned. Binds each designed page to the endpoints that actually exist.
//
// The pages ship as finished markup with sample rows. Nothing here re-authors
// them: a binder finds the table, the figure or the button it needs and puts
// the real record into the existing design. Anything the API cannot answer for
// is left visibly marked rather than filled with something plausible.

import { api, auth, clearTokens, isSignedIn, saveTokens, type Paginated } from "./api";
import {
  clearDemoData,
  fillList,
  fillTable,
  findByText,
  money,
  relative,
  shortDate,
  showBanner,
  showTableState,
  titleCase,
  writeText,
} from "./dom";
import { recordIdFromPath, type PageName } from "./routes";

// ---------------------------------------------------------------- API shapes

type Quotation = {
  id: string;
  code: string;
  status: string;
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  marginBps: number;
  ownerUserId: string;
  ownerName?: string;
  validUntil: string | null;
  lastActivityAt: string;
  customer: { name: string; tier: { code: string } | null } | null;
  lines?: QuotationLine[];
};

type QuotationLine = {
  id: string;
  productId: string;
  description: string;
  qty: number;
  unitPriceMinor: number;
  discountBps: number;
  lineTotalMinor: number;
  lineType: string;
};

type Approval = {
  id: string;
  quotationId: string;
  quotationCode: string;
  customerName: string;
  status: string;
  currentStep: string | null;
  riskScore: number;
  riskLevel: string;
  total: { amountMinor: number; currency: string };
  createdAt: string;
};

type ApprovalDetail = Approval & {
  evaluation: {
    riskScore: number;
    riskLevel: string;
    approvalRequired: boolean;
    requiredApprovals: string[];
    violations: Array<{ categoryName: string; allowedBps: number; actualBps: number; excessBps: number }>;
    blended: { weightedExcessBps: number; worstLineExcessBps: number; marginBps: number };
    factors: Array<{ label: string; points: number; maxPoints: number; detail: string }>;
    lineCeilings: Array<{ quoteLineId: string; allowedDiscountBps: number; actualDiscountBps: number; overBps: number }>;
  };
  steps: Array<{ sequence: number; approverRole: string; status: string; decidedAt: string | null }>;
};

type Order = {
  id: string;
  code: string;
  status: string;
  currency: string;
  totalMinor: number;
  createdAt: string;
  quotation?: { code?: string; customer?: { name: string } | null } | null;
  lines?: QuotationLine[];
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
  orderCode: string;
  customerName: string;
  status: string;
  totalMinor: number;
  paidMinor: number;
  currency: string;
  createdAt: string;
  lines?: Array<{ id: string; orderLineId: string; amountMinor: number }>;
  payments?: Array<{ id: string; amountMinor: number; method: string; reference: string; createdAt: string }>;
  orderLines?: QuotationLine[];
};

type Subscription = {
  id: string;
  orderId: string;
  orderCode: string;
  customerName: string;
  status: string;
  amountMinor: number;
  currency: string;
  cadenceMonths: number;
  createdAt: string;
  schedules?: Array<{ id: string; dueAt: string; amountMinor: number; currency: string; invoiceId: string | null }>;
  orderLines?: QuotationLine[];
};

type Fulfillment = {
  id: string;
  orderId: string;
  orderCode: string;
  customerName: string;
  status: string;
  updatedAt: string;
};

type AllocationPlan = {
  orderId: string;
  allocations: Array<{
    warehouseId: string;
    warehouseName: string;
    productId: string;
    qty: number;
    shipments: number;
    shippingCost: { amountMinor: number; currency: string };
  }>;
  backorder: Array<{ productId: string; qty: number; reason: string }>;
  totalShipments: number;
  totalShippingCost: { amountMinor: number; currency: string };
};

type DealHealth = {
  id: string;
  quotationId: string;
  quotationCode: string;
  customerName: string;
  type: string;
  severity: string;
  message: string;
  detectedAt: string;
};

type AuditEntry = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorRole: string | null;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
};

type DiscountPolicy = {
  id: string;
  tierId: string;
  tierCode: string;
  categoryId: string | null;
  categoryName: string | null;
  maxDiscountBps: number;
  requiresManagerAboveBps: number;
  requiresFinanceAboveBps: number;
  isActive: boolean;
};

type NegotiationMessage = {
  id: string;
  negotiationId: string;
  body: string;
  requestedDiscountBps: number | null;
  createdAt: string;
};

type NoteThread = { quotationId: string; code: string; messages: NegotiationMessage[] };

// -------------------------------------------------------------- small helpers

const tbodies = (root: HTMLElement): HTMLElement[] => [...root.querySelectorAll<HTMLElement>("tbody")];
const pct = (bps: number): string => `${(bps / 100).toFixed(1)}%`;
const recordId = (): string => decodeURIComponent(recordIdFromPath(window.location.pathname) ?? "");

/** Marks a control as connected and gives it a real handler. */
function action(
  root: HTMLElement,
  element: HTMLElement | null | undefined,
  label: string,
  run: () => Promise<string>,
): HTMLElement | undefined {
  if (!element) return undefined;

  // Every designed page wires its own simulation to these buttons - disable
  // itself, wait 600ms, claim "Routed to Stage 3" - and those listeners are
  // attached while the page script is eval'd, which is before any of this runs.
  // Adding a second listener is not enough: the simulation runs first, disables
  // the control, and the real handler finds nothing to do. Replacing the node
  // with a clone is the only thing that reliably drops listeners we did not add,
  // including page-client's navigation shortcuts.
  const button = element.cloneNode(true) as HTMLElement;
  element.replaceWith(button);

  // The "not connected" guard in ui.ts matches the closest marked ancestor on
  // the capture phase, so a wired submit button inside a still-marked form is
  // blocked the moment anyone presses Enter instead of clicking.
  for (const node of [button, button.closest<HTMLElement>("form[data-unavailable]")]) {
    if (!node) continue;
    delete node.dataset.unavailable;
    node.removeAttribute("aria-disabled");
  }
  button.title = label;
  (button as HTMLButtonElement).disabled = false;

  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const control = button as HTMLButtonElement;
    if (control.disabled) return;
    control.disabled = true;
    control.setAttribute("aria-busy", "true");
    try {
      showBanner(root, await run(), "info");
    } catch (error) {
      showBanner(root, (error as Error).message);
    } finally {
      control.disabled = false;
      control.removeAttribute("aria-busy");
    }
  });
  return button;
}

/**
 * Exports whatever the table currently shows.
 *
 * Every list screen has an "Export CSV" button and there is no export endpoint
 * behind any of them. The rows are already in the browser, so building the file
 * here is both the smaller change and the more honest one - what downloads is
 * exactly what the user is looking at.
 */
function bindExport(root: HTMLElement, filename: string): void {
  const button = findByText(root, /Export (CSV|Ledger|Audit Log|Exception Log)|Download Raw CSV/i, "button");
  if (!button) return;

  action(root, button, "Download these rows as CSV", async () => {
    const table = root.querySelector("table");
    if (!table) throw new Error("Nothing to export on this screen.");

    const cell = (element: Element) => {
      const copy = element.cloneNode(true) as Element;
      copy.querySelectorAll(".material-symbols-outlined").forEach((icon) => icon.remove());
      return `"${(copy.textContent ?? "").replace(/\s+/g, " ").trim().replace(/"/g, '""')}"`;
    };
    const rows = [...table.querySelectorAll("tr")]
      .map((row) => [...row.querySelectorAll("th, td")].map(cell).join(","))
      .filter((line) => line.replace(/[",]/g, "").trim());

    const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    return `Exported ${rows.length - 1} rows.`;
  });
}

/**
 * Downloads a generated document built in the browser.
 *
 * There is no server PDF endpoint, and inventing one is out of scope. The data
 * a "Download PDF" button wants is already loaded on the page, so - exactly like
 * bindExport builds a CSV in-browser - this writes a self-contained, printable
 * HTML file and hands it to the browser. It is honestly a generated document,
 * not a server-rendered PDF; the caller's label says so.
 */
function downloadDocument(filename: string, title: string, rows: Array<[string, string]>, lines?: { head: string[]; body: string[][] }): void {
  const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const meta = rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("");
  const table = lines
    ? `<h2>Line items</h2><table class="lines"><thead><tr>${lines.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>`
      + `<tbody>${lines.body.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`
    : "";
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1D2430; margin: 40px; }
  h1 { font-size: 22px; border-bottom: 2px solid #1D2430; padding-bottom: 8px; }
  h2 { font-size: 15px; margin-top: 28px; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; }
  th, td { border: 1px solid #1D2430; padding: 6px 10px; text-align: left; font-size: 13px; }
  table:not(.lines) th { width: 220px; background: #F4F0E7; }
  .lines thead th { background: #E9E3D8; }
  .foot { margin-top: 40px; font-size: 11px; color: #434654; }
  @media print { body { margin: 0; } }
</style></head><body onload="window.print()">
  <h1>${esc(title)}</h1>
  <table>${meta}</table>
  ${table}
  <p class="foot">Generated by DealFlow360 on ${new Date().toLocaleString()}. This is a generated document, not a certified invoice.</p>
</body></html>`;

  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.html`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Wires the designed status chips to the endpoint's own status filter. */
function bindStatusFilter(root: HTMLElement, statuses: Record<string, string | undefined>, load: (status?: string) => Promise<void>): void {
  const bar = findByText(root, /^All\b/, "button")?.parentElement;
  if (!bar) return;

  for (const chip of bar.querySelectorAll<HTMLButtonElement>("button")) {
    const label = (chip.textContent ?? "").replace(/\s*\(\d+\)\s*/, "").trim();
    if (!(label in statuses)) continue;
    chip.disabled = false;
    delete chip.dataset.unavailable;
    chip.title = `Show ${label.toLowerCase()} records`;
    chip.addEventListener("click", async (event) => {
      event.preventDefault();
      for (const other of bar.querySelectorAll("button")) other.setAttribute("aria-pressed", String(other === chip));
      try {
        await load(statuses[label]);
      } catch (error) {
        showBanner(root, (error as Error).message);
      }
    });
  }
}

/** Puts a value into the element that follows a label in the designed markup. */
function setFigure(root: HTMLElement, label: RegExp, value: string): void {
  const holder = findByText(root, label, "p, span, dt, h2, h3, div");
  const figure = holder?.nextElementSibling ?? holder?.parentElement?.querySelector("p, span");
  if (figure) writeText(figure, value);
}

/** Replaces every occurrence of a sample token with the real one. */
function replaceToken(root: HTMLElement, sample: RegExp, value: string): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    if (node.parentElement?.closest(".material-symbols-outlined")) continue;
    if (sample.test(node.data)) node.data = node.data.replace(sample, value);
  }
}

/**
 * The customer portal has its own "Acme Portal" header and #portal-profile box.
 * It must never grow the internal session chrome, so give it a portal-shaped
 * sign-out instead: swap the sample "Acme Corp Procurement / Alex Vance" for the
 * signed-in customer and add a logout control beside it.
 */
async function mountPortalSession(root: HTMLElement): Promise<void> {
  const profile = root.querySelector<HTMLElement>("#portal-profile");
  if (!profile || profile.parentElement?.querySelector("[data-df-portal-signout]")) return;

  const who = await auth.me();
  if (who) {
    const name = profile.querySelector<HTMLElement>(".font-label-md");
    if (name) writeText(name, who.name);
    const sub = profile.querySelector<HTMLElement>(".font-mono-metric-sm");
    if (sub) writeText(sub, `(${who.email})`);
  }

  const out = document.createElement("button");
  out.type = "button";
  out.dataset.dfPortalSignout = "true";
  out.className = "inline-flex items-center gap-space-xxs bg-[#F4F0E7] border-[1.5px] border-[#1D2430] px-space-xs py-1 font-label-md text-label-md text-[#1D2430]";
  out.title = who ? `Signed in as ${who.name} — sign out` : "Sign out";
  out.innerHTML = '<span class="material-symbols-outlined text-body-md" aria-hidden="true">logout</span><span>Sign out</span>';
  out.addEventListener("click", () => {
    clearTokens();
    window.location.assign("/login/");
  });
  profile.after(out);
}

/** The signed-in identity, plus a way out, in every page header. */
async function mountSession(root: HTMLElement): Promise<void> {
  const anchor = root.querySelector<HTMLElement>(":scope > header .flex.items-center:last-child")
    ?? root.querySelector<HTMLElement>(":scope > header");
  if (!anchor || anchor.querySelector("[data-df-session]")) return;

  const box = document.createElement("div");
  box.dataset.dfSession = "true";
  box.className = "flex items-center gap-space-xxs pl-space-xs shrink-0 whitespace-nowrap";
  anchor.append(box);

  const who = await auth.me();
  if (!who) {
    const link = document.createElement("a");
    link.href = "/login/";
    link.className = "font-label-md text-label-md text-primary underline";
    link.textContent = "Sign in";
    box.append(link);
    return;
  }

  const name = document.createElement("div");
  name.className = "hidden xl:flex flex-col leading-tight max-w-[150px] overflow-hidden";
  const person = document.createElement("span");
  person.className = "font-label-md text-label-md text-on-surface truncate";
  person.textContent = who.name;
  const role = document.createElement("span");
  role.className = "font-mono-metric-sm text-mono-metric-sm text-on-surface-variant uppercase truncate";
  role.textContent = who.role.replace(/_/g, " ");
  name.append(person, role);

  const out = document.createElement("button");
  out.type = "button";
  out.className = "inline-flex items-center border border-outline bg-surface-container-lowest px-space-xxs py-space-xxs";
  out.title = `Signed in as ${who.name} (${who.role.replace(/_/g, " ")}) — sign out`;
  out.setAttribute("aria-label", out.title);
  out.innerHTML = '<span class="material-symbols-outlined text-[18px]" aria-hidden="true">logout</span>';
  out.addEventListener("click", () => {
    clearTokens();
    window.location.assign("/login/");
  });

  box.append(name, out);
}

/** Pagination and search over the page of records the server returned. */
function tableControls<T>(
  root: HTMLElement,
  tbody: HTMLElement,
  result: Paginated<T>,
  load: (page: number) => Promise<void>,
): void {
  const rows = result.items.length ? ([...tbody.children] as HTMLElement[]) : [];
  const search = root.querySelector<HTMLInputElement>('main input[placeholder*="Search"], main input[placeholder*="Filter quote"]');
  if (search) {
    search.disabled = false;
    search.removeAttribute("title");
    search.placeholder = "Search this page of records…";
    search.setAttribute("aria-label", "Search this page of records");
    search.oninput = () => {
      const query = search.value.trim().toLowerCase();
      const matches = rows.filter((row) => row.textContent?.toLowerCase().includes(query));
      if (matches.length) tbody.replaceChildren(...matches);
      else showTableState(tbody, "No matching records on this page.");
    };
  }

  const count = [...root.querySelectorAll<HTMLElement>("[data-record-count]")].find(
    (node) => node.dataset.recordCount === tbody.closest("table")?.id,
  );
  let footer = root.querySelector<HTMLElement>("[data-pagination]") ?? count?.parentElement;
  while (footer && !footer.querySelector("button")) footer = footer.parentElement;
  if (!footer || footer.contains(tbody)) return;

  const label = document.createElement("span");
  label.className = "font-mono-metric-sm text-mono-metric-sm text-on-surface-variant";
  label.textContent = `${result.items.length} of ${result.total} records · Page ${result.page}`;
  label.setAttribute("role", "status");

  const controls = [document.createElement("button"), document.createElement("button")];
  controls.forEach((button, index) => {
    button.type = "button";
    button.textContent = index ? "Next" : "Prev";
    button.className = "border border-outline bg-surface-container-lowest px-space-sm py-space-xs font-label-md text-label-md";
    button.disabled = index ? result.page * result.pageSize >= result.total : result.page <= 1;
    button.onclick = async () => {
      controls.forEach((control) => { control.disabled = true; });
      tbody.setAttribute("aria-busy", "true");
      try {
        await load(result.page + (index ? 1 : -1));
      } catch (error) {
        showBanner(root, (error as Error).message);
      } finally {
        tbody.setAttribute("aria-busy", "false");
      }
    };
  });

  footer.dataset.pagination = "true";
  footer.className = "flex items-center justify-between gap-space-sm px-space-md py-space-xs border-t-[1.5px] border-outline";
  footer.replaceChildren(controls[0], label, controls[1]);
}

/** Turns a cloned sample row into a link to the record it now shows. */
function linkRow(row: HTMLElement, href: string, label: string): void {
  for (const control of row.querySelectorAll<HTMLElement>("a, button")) {
    if (control.querySelector('input[type="checkbox"]')) continue;
    const link = document.createElement("a");
    link.href = href;
    link.className = `${control.className} df-row-link`;
    link.title = label;
    link.innerHTML = control.innerHTML;
    control.replaceWith(link);
  }
  // Fall back to linking the first cell that actually holds the record's name.
  // The leading column is often a selection checkbox; replacing its contents
  // with a link deletes the checkbox and breaks select-all.
  const first = [...row.querySelectorAll("td")].find(
    (cell) => !cell.querySelector("input, select, textarea, a") && cell.textContent?.trim(),
  );
  if (!first) return;
  const link = document.createElement("a");
  link.href = href;
  link.className = "text-primary underline df-row-link";
  link.title = label;
  link.textContent = first.textContent?.trim() || label;
  first.replaceChildren(link);
}

// ------------------------------------------------------------- list bindings

async function bindDashboard(root: HTMLElement): Promise<void> {
  // The approval queue and the audit log are manager-and-above. A sales rep's
  // dashboard should still render the two cards they are allowed to see rather
  // than failing whole on a 403, so each figure is settled independently.
  const [quotes, approvals, health, activity] = await Promise.allSettled([
    api.get<Paginated<Quotation>>("/quotes?pageSize=100"),
    api.get<Paginated<Approval>>("/approvals?pageSize=100"),
    api.get<DealHealth[]>("/deal-health"),
    api.get<AuditEntry[]>("/audit?take=6"),
  ]);
  const value = <T,>(result: PromiseSettledResult<T>, fallback: T): T =>
    result.status === "fulfilled" ? result.value : fallback;

  const quotePage = value(quotes, { items: [], total: 0, page: 1, pageSize: 0 });
  const approvalPage = value(approvals, { items: [], total: 0, page: 1, pageSize: 0 });
  const healthItems = value(health, [] as DealHealth[]);
  const auditItems = value(activity, [] as AuditEntry[]);

  const open = quotePage.items.filter((quote) => quote.status !== "CONFIRMED" && quote.status !== "REJECTED");
  const pipeline = open.reduce((sum, quote) => sum + quote.totalMinor, 0);

  setFigure(root, /^Pending Approvals$/, approvals.status === "fulfilled" ? String(approvalPage.total) : "—");
  setFigure(root, /^Open Quotations$/, String(open.length));
  setFigure(root, /^At-Risk Deals$/, String(healthItems.length));
  replaceToken(root, /quotations waiting/, `awaiting a decision`);
  replaceToken(root, /active deals · ₹[\d,.]+/, `active deals · ${money(pipeline)}`);
  replaceToken(root, /\b3 PENDING\b/, `${approvalPage.total} PENDING`);

  const list = root.querySelector<HTMLElement>("[data-entry-list]");
  if (list) {
    fillList(list, auditItems.slice(0, 6), (entry, event) => {
      const parts = [...entry.querySelectorAll<HTMLElement>("span, p, h3, h4")].filter(
        (node) => node.textContent?.trim() && !node.classList.contains("material-symbols-outlined"),
      );
      const text = [
        event.entityType.replace(/_/g, " "),
        event.entityId.slice(0, 10),
        titleCase(event.action),
        event.toValue ? `${event.fromValue ?? "—"} → ${event.toValue}` : (event.actorRole ?? ""),
        relative(event.createdAt),
      ];
      parts.forEach((node, index) => {
        if (index < text.length) writeText(node, text[index]);
      });
    });
  }
}

async function bindQuotations(root: HTMLElement, pageNumber = 1, status?: string): Promise<void> {
  const [tbody] = tbodies(root);
  if (!tbody) return;

  const filter = status ? `&status=${status}` : "";
  const page = await api.get<Paginated<Quotation>>(`/quotes?pageSize=25&page=${pageNumber}${filter}`);
  fillTable(
    tbody,
    page.items,
    (quote) => ({
      0: quote.code,
      1: [quote.customer?.name ?? "—", quote.customer?.tier?.code ?? "—"],
      2: quote.ownerName ?? quote.ownerUserId,
      3: money(quote.totalMinor, quote.currency),
      4: quote.discountMinor > 0 ? `Discount ${money(quote.discountMinor, quote.currency)}` : "At list price",
      5: titleCase(quote.status),
      6: shortDate(quote.validUntil),
      7: relative(quote.lastActivityAt),
    }),
    (row, quote) => linkRow(row, `/quotations/${quote.code}/`, `Open ${quote.code}`),
  );
  tableControls(root, tbody, page, (next) => bindQuotations(root, next, status));

  bindExport(root, "quotations");
  bindStatusFilter(
    root,
    {
      All: undefined,
      Draft: "DRAFT",
      "Pending Approval": "PENDING_MANAGER",
      Approved: "APPROVED",
      "In Negotiation": "NEGOTIATING",
      Confirmed: "CONFIRMED",
    },
    (next) => bindQuotations(root, 1, next),
  );
  await bindNewQuotation(root);
}

/**
 * "New Quotation" has to ask which customer before it can create anything, so
 * it opens a small chooser rather than silently picking one. The quote lands in
 * DRAFT and the browser goes straight to its detail page.
 */
async function bindNewQuotation(root: HTMLElement): Promise<void> {
  const button = findByText(root, /New Quotation/i, "button");
  if (!button) return;

  const customers = await api.get<Paginated<{ id: string; name: string }>>("/customers?pageSize=100").catch(() => null);
  if (!customers?.items.length) {
    button.dataset.unavailable = "No customers exist yet to raise a quotation against.";
    button.title = button.dataset.unavailable;
    return;
  }

  action(root, button, "Raise a new quotation", async () => {
    const chosen = await chooseCustomer(root, customers.items);
    if (!chosen) return "Cancelled.";
    const quote = await api.post<Quotation>("/quotes", { customerId: chosen, currency: "INR" });
    window.location.assign(`/quotations/${quote.code}/`);
    return `Created ${quote.code}.`;
  });
}

function chooseCustomer(root: HTMLElement, customers: Array<{ id: string; name: string }>): Promise<string | null> {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 p-space-md";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.setAttribute("aria-label", "Choose a customer");

    const panel = document.createElement("div");
    panel.className = "w-full max-w-sm border-[2px] border-outline bg-surface-bright p-space-md flex flex-col gap-space-sm";

    const heading = document.createElement("h2");
    heading.className = "font-headline-sm text-headline-sm uppercase tracking-wider";
    heading.textContent = "New quotation";

    const label = document.createElement("label");
    label.className = "font-label-sm text-label-sm uppercase tracking-wider";
    label.textContent = "Customer";
    label.htmlFor = "df-new-quote-customer";

    const select = document.createElement("select");
    select.id = "df-new-quote-customer";
    select.className = "w-full border border-outline bg-surface-container-lowest px-space-sm py-2 font-body-md text-body-md";
    for (const customer of customers) {
      const option = document.createElement("option");
      option.value = customer.id;
      option.textContent = customer.name;
      select.append(option);
    }

    const buttons = document.createElement("div");
    buttons.className = "flex justify-end gap-space-xs pt-space-xs";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "border border-outline px-space-sm py-2 font-label-md text-label-md";
    cancel.textContent = "Cancel";
    const create = document.createElement("button");
    create.type = "button";
    create.className = "border-[2px] border-outline bg-primary text-on-primary px-space-sm py-2 font-label-md text-label-md";
    create.textContent = "Create draft";
    buttons.append(cancel, create);

    const close = (value: string | null) => {
      backdrop.remove();
      resolve(value);
    };
    cancel.addEventListener("click", () => close(null));
    create.addEventListener("click", () => close(select.value));
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close(null);
    });
    backdrop.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close(null);
    });

    panel.append(heading, label, select, buttons);
    backdrop.append(panel);
    root.append(backdrop);
    select.focus();
  });
}

async function bindApprovals(root: HTMLElement, pageNumber = 1): Promise<void> {
  const [tbody] = tbodies(root);
  if (!tbody) return;

  const page = await api.get<Paginated<Approval>>(`/approvals?pageSize=25&page=${pageNumber}`);
  fillTable(
    tbody,
    page.items,
    (approval) => ({
      1: approval.quotationCode,
      2: approval.customerName,
      3: `${approval.riskLevel} · score ${approval.riskScore}`,
      4: money(approval.total.amountMinor, approval.total.currency),
      5: approval.currentStep ? titleCase(approval.currentStep) : titleCase(approval.status),
      6: `Raised ${relative(approval.createdAt)}`,
    }),
    (row, approval) => linkRow(row, `/approvals/${approval.id}/`, `Review ${approval.quotationCode}`),
  );
  tableControls(root, tbody, page, (next) => bindApprovals(root, next));
  bindExport(root, "approvals");
}

async function bindFulfillment(root: HTMLElement): Promise<void> {
  const [inventoryBody, ordersBody] = tbodies(root);

  const [stock, orders, fulfillments] = await Promise.all([
    api.get<Paginated<InventoryRow>>("/inventory?pageSize=50"),
    api.get<Paginated<Order>>("/orders?pageSize=25"),
    api.get<Paginated<Fulfillment>>("/fulfillments?pageSize=50"),
  ]);

  if (inventoryBody) {
    fillTable(
      inventoryBody,
      stock.items,
      (row) => ({
        0: [row.productName, `SKU: ${row.sku}`],
        1: [row.warehouseName, row.warehouseCode],
        2: String(row.onHand),
        3: String(row.reserved),
        4: String(row.available),
        5: "—",
        6: row.available > 0 ? "In Stock" : "Out Of Stock",
      }),
      () => {},
    );
  }

  const stateByOrder = new Map(fulfillments.items.map((row) => [row.orderId, row]));
  if (ordersBody) {
    fillTable(
      ordersBody,
      orders.items,
      (order) => ({
        0: [order.code, order.quotation?.code ?? "—"],
        1: order.quotation?.customer?.name ?? "—",
        2: `${order._count?.lines ?? order.lines?.length ?? 0} lines · ${money(order.totalMinor, order.currency)}`,
        3: "Availability first",
        4: "—",
        5: relative(order.createdAt),
        6: titleCase(stateByOrder.get(order.id)?.status ?? order.status),
      }),
      (row, order) => linkRow(row, `/fulfillment/${order.code}/`, `Allocate ${order.code}`),
    );
  }

  bindExport(root, "fulfillment");

  // The two toolbar actions move the queue forward. Point each at the first
  // order that can legally make that move, and say which one it is.
  for (const [pattern, target, verb] of [
    [/Approve & Generate Slips/i, "PICKING", "Start picking"],
    [/Initiate Transit/i, "SHIPPED", "Ship"],
  ] as const) {
    const button = findByText(root, pattern, "button");
    if (!button) continue;
    const ready = fulfillments.items.find((row) => NEXT_FULFILMENT[row.status] === target);
    if (!ready) {
      button.dataset.unavailable = `No order is ready to ${verb.toLowerCase()} right now.`;
      button.title = button.dataset.unavailable;
      continue;
    }
    action(root, button, `${verb} ${ready.orderCode}`, async () => {
      await api.patch(`/fulfillments/${ready.id}`, { status: target });
      await bindFulfillment(root);
      return `${ready.orderCode} is now ${titleCase(target)}.`;
    });
  }
}

/** The one legal next state for a fulfilment, per the B3 transition table. */
const NEXT_FULFILMENT: Record<string, string> = {
  ORDER_CONFIRMED: "INVENTORY_RESERVED",
  INVENTORY_RESERVED: "PICKING",
  PICKING: "PACKED",
  PACKED: "SHIPPED",
  SHIPPED: "DELIVERED",
};

async function bindInvoices(root: HTMLElement, pageNumber = 1): Promise<void> {
  const [tbody] = tbodies(root);
  if (!tbody) return;

  const page = await api.get<Paginated<Invoice>>(`/invoices?pageSize=25&page=${pageNumber}`);
  fillTable(
    tbody,
    page.items,
    (invoice) => ({
      0: invoice.id.slice(-8).toUpperCase(),
      1: invoice.customerName,
      2: invoice.orderCode,
      3: "One-time",
      4: money(invoice.totalMinor, invoice.currency),
      5: `${titleCase(invoice.status)} · ${money(invoice.paidMinor, invoice.currency)} paid`,
      6: relative(invoice.createdAt),
      7: "Shipped",
    }),
    (row, invoice) => linkRow(row, `/invoices/${invoice.id}/`, `Open invoice for ${invoice.orderCode}`),
  );
  tableControls(root, tbody, page, (next) => bindInvoices(root, next));

  // "Generate invoice" only makes sense for an order that has shipped and has
  // not been billed, so offer it per order rather than as a decorative button.
  const [orders, fulfillments] = await Promise.all([
    api.get<Paginated<Order>>("/orders?pageSize=50"),
    api.get<Paginated<Fulfillment>>("/fulfillments?pageSize=50"),
  ]);
  const billed = new Set(page.items.map((invoice) => invoice.orderId));
  const shipped = new Set(
    fulfillments.items.filter((row) => row.status === "SHIPPED" || row.status === "DELIVERED").map((row) => row.orderId),
  );
  const candidate = orders.items.find((order) => shipped.has(order.id) && !billed.has(order.id));

  bindExport(root, "invoices");
  const generate = findByText(root, /Generate .*Invoice/i, "button");
  if (!generate) return;
  if (!candidate) {
    generate.dataset.unavailable = "Every shipped order is already invoiced. Ship an order on the Fulfillment screen to enable this.";
    generate.title = generate.dataset.unavailable;
    return;
  }
  action(root, generate, `Invoice ${candidate.code}`, async () => {
    await api.post(`/orders/${candidate.id}/invoices`);
    await bindInvoices(root);
    return `Invoiced ${candidate.code}.`;
  });
}

async function bindSubscriptions(root: HTMLElement, pageNumber = 1): Promise<void> {
  const [tbody] = tbodies(root);
  if (!tbody) return;

  const page = await api.get<Paginated<Subscription>>(`/subscriptions?pageSize=25&page=${pageNumber}`);
  fillTable(
    tbody,
    page.items,
    (subscription) => ({
      0: subscription.id.slice(-8).toUpperCase(),
      1: subscription.customerName,
      2: subscription.orderCode,
      3: subscription.cadenceMonths === 1 ? "Monthly" : `Every ${subscription.cadenceMonths} months`,
      4: shortDate(subscription.schedules?.[0]?.dueAt),
      5: money(subscription.amountMinor, subscription.currency),
      6: titleCase(subscription.status),
    }),
    (row, subscription) => linkRow(row, `/subscriptions/${subscription.id}/`, `Open ${subscription.orderCode}`),
  );
  tableControls(root, tbody, page, (next) => bindSubscriptions(root, next));
  bindExport(root, "subscriptions");
}

async function bindDealHealth(root: HTMLElement): Promise<void> {
  const [tbody] = tbodies(root);
  if (!tbody) return;

  const items = await api.get<DealHealth[]>("/deal-health");
  fillTable(
    tbody,
    items,
    (item) => ({
      0: item.quotationCode,
      1: item.customerName,
      2: [titleCase(item.type), item.message],
      3: titleCase(item.severity),
      4: "—",
      5: relative(item.detectedAt),
      6: "—",
    }),
    (row, item) => {
      linkRow(row, `/quotations/${item.quotationCode}/`, `Open ${item.quotationCode}`);
      const nudge = row.querySelector<HTMLElement>("td:last-child a, td:last-child button");
      if (nudge) {
        nudge.removeAttribute("href");
        action(root, nudge, "Nudge the deal owner", async () => {
          await api.post(`/deal-health/${item.id}/nudge`);
          return `Nudged the owner of ${item.quotationCode}.`;
        });
      }
    },
  );

  bindExport(root, "deal-health");

  // The sweep is the whole point of this screen and the design never gave it a
  // button, so add one beside the export rather than overloading an unrelated
  // control with a meaning its label does not carry.
  const toolbar = findByText(root, /Export Exception Log/i, "button")?.parentElement;
  root.querySelector("[data-df-sweep]")?.remove();
  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.dataset.dfSweep = "true";
  refresh.className =
    "inline-flex items-center gap-space-xxs border-[2px] border-outline bg-primary text-on-primary px-space-sm py-2 font-label-md text-label-md";
  refresh.innerHTML =
    '<span class="material-symbols-outlined text-[16px]" aria-hidden="true">refresh</span><span>Run Sweep</span>';
  toolbar?.prepend(refresh);

  action(root, refresh, "Re-run the deal health sweep", async () => {
    const sweep = await api.post<{ scanned: number; findings: number }>("/deal-health/refresh");
    await bindDealHealth(root);
    return `Swept ${sweep.scanned} quotations — ${sweep.findings} exceptions open.`;
  });

  // "Global Governance Rules" opens the live discount-policy table. ADMIN can
  // edit ceilings in place; everyone else reads them. This is the real control
  // behind what used to be a dead button.
  const governance = findByText(root, /Global Governance Rules/i, "button");
  if (governance) {
    action(root, governance, "View and edit discount ceilings", async () => {
      await openGovernancePanel(root);
      return "Opened the discount governance rules.";
    });
  }
}

/**
 * The discount-policy governance panel: one row per tier/category ceiling from
 * GET /discount-policies. ADMIN sees editable inputs that PATCH the policy;
 * every other role sees the same numbers read-only. Reused by both the
 * deal-health screen and the reports screen.
 */
async function openGovernancePanel(root: HTMLElement): Promise<void> {
  const [policies, who] = await Promise.all([api.get<DiscountPolicy[]>("/discount-policies"), auth.me()]);
  const canEdit = who?.role === "ADMIN";

  const backdrop = document.createElement("div");
  backdrop.className = "fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 p-space-md";
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");
  backdrop.setAttribute("aria-label", "Discount governance rules");

  const panel = document.createElement("div");
  panel.className = "w-full max-w-3xl max-h-[85vh] overflow-auto border-[2px] border-outline bg-surface-bright p-space-md flex flex-col gap-space-sm";

  const head = document.createElement("div");
  head.className = "flex items-center justify-between gap-space-sm";
  const heading = document.createElement("h2");
  heading.className = "font-headline-sm text-headline-sm uppercase tracking-wider";
  heading.textContent = "Global governance rules";
  const closeX = document.createElement("button");
  closeX.type = "button";
  closeX.className = "border border-outline px-space-sm py-1 font-label-md text-label-md";
  closeX.textContent = "Close";
  head.append(heading, closeX);

  const note = document.createElement("p");
  note.className = "font-body-sm text-body-sm text-on-surface-variant";
  note.textContent = canEdit
    ? "Per-tier and per-category discount ceilings. Edit a value and press Save to update the policy the engine routes on."
    : "Per-tier and per-category discount ceilings, read-only. An ADMIN account can edit these.";

  const table = document.createElement("table");
  table.className = "w-full text-left border-collapse font-body-md text-body-md";
  table.innerHTML =
    '<thead><tr class="border-b-[1.5px] border-outline font-mono-metric-sm text-mono-metric-sm uppercase">'
    + '<th class="py-space-xs pr-space-sm">Tier</th><th class="py-space-xs pr-space-sm">Category</th>'
    + '<th class="py-space-xs pr-space-sm">Max discount %</th><th class="py-space-xs pr-space-sm">Manager above %</th>'
    + '<th class="py-space-xs pr-space-sm">Finance above %</th>'
    + (canEdit ? '<th class="py-space-xs"></th>' : "")
    + "</tr></thead>";
  const body = document.createElement("tbody");
  body.className = "divide-y-[1px] divide-outline-variant";

  const pctInput = (value: number): HTMLInputElement => {
    const input = document.createElement("input");
    input.type = "number";
    input.step = "0.1";
    input.min = "0";
    input.max = "100";
    input.value = (value / 100).toFixed(1);
    input.className = "w-20 border border-outline bg-surface-container-lowest px-space-xxs py-1 font-mono-metric-sm text-mono-metric-sm";
    input.disabled = !canEdit;
    return input;
  };

  for (const policy of policies) {
    const row = document.createElement("tr");
    const cell = (text: string) => {
      const td = document.createElement("td");
      td.className = "py-space-xs pr-space-sm";
      td.textContent = text;
      return td;
    };
    row.append(cell(policy.tierCode), cell(policy.categoryName ?? "All categories"));

    const maxIn = pctInput(policy.maxDiscountBps);
    const mgrIn = pctInput(policy.requiresManagerAboveBps);
    const finIn = pctInput(policy.requiresFinanceAboveBps);
    for (const input of [maxIn, mgrIn, finIn]) {
      const td = document.createElement("td");
      td.className = "py-space-xs pr-space-sm";
      td.append(input);
      row.append(td);
    }

    if (canEdit) {
      const save = document.createElement("button");
      save.type = "button";
      save.className = "border-[1.5px] border-outline bg-primary text-on-primary px-space-sm py-1 font-label-md text-label-md";
      save.textContent = "Save";
      const td = document.createElement("td");
      td.className = "py-space-xs";
      td.append(save);
      row.append(td);

      save.addEventListener("click", async () => {
        save.disabled = true;
        try {
          const toBps = (input: HTMLInputElement) => Math.round(Number(input.value) * 100);
          const updated = await api.patch<DiscountPolicy>(`/discount-policies/${policy.id}`, {
            maxDiscountBps: toBps(maxIn),
            requiresManagerAboveBps: toBps(mgrIn),
            requiresFinanceAboveBps: toBps(finIn),
          });
          maxIn.value = (updated.maxDiscountBps / 100).toFixed(1);
          mgrIn.value = (updated.requiresManagerAboveBps / 100).toFixed(1);
          finIn.value = (updated.requiresFinanceAboveBps / 100).toFixed(1);
          showBanner(root, `Updated ${policy.tierCode} / ${policy.categoryName ?? "all"} ceiling.`, "info");
        } catch (error) {
          showBanner(root, (error as Error).message);
        } finally {
          save.disabled = false;
        }
      });
    }
    body.append(row);
  }
  table.append(body);
  panel.append(head, note, table);
  backdrop.append(panel);

  const close = () => backdrop.remove();
  closeX.addEventListener("click", close);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  backdrop.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  root.append(backdrop);
  closeX.focus();
}

async function bindReports(root: HTMLElement): Promise<void> {
  const [tbody] = tbodies(root);
  if (!tbody) return;

  const stock = await api.get<Paginated<InventoryRow>>("/inventory?pageSize=50");
  // One row per SKU: the catalogue table is not a per-depot view.
  const bySku = new Map<string, InventoryRow>();
  for (const row of stock.items) if (!bySku.has(row.sku)) bySku.set(row.sku, row);
  const items = [...bySku.values()];

  fillTable(
    tbody,
    items,
    (row) => ({
      1: [row.productName, `SKU: ${row.sku}`],
      2: "—",
      3: "—",
      4: "—",
      5: "—",
      6: `${row.onHand} on hand across depots`,
      7: row.available > 0 ? "Active" : "Out Of Stock",
    }),
    () => {},
  );
  tableControls(root, tbody, { items, total: items.length, page: 1, pageSize: items.length || 1 }, async () => {});
  bindExport(root, "catalogue");

  // The two governance panels ship with hard-coded 5/10/15% figures. Replace
  // them with the live per-tier ceilings, and point "Edit Tier Matrix" /
  // "Configure Rules" at the same ADMIN-editable governance panel the
  // deal-health screen uses. FX/price-book controls stay honest data-unavailable.
  const policies = await api.get<DiscountPolicy[]>("/discount-policies").catch(() => [] as DiscountPolicy[]);
  if (policies.length) {
    // The tier panel shows one row per tier; fill the ₹-ceiling figure next to
    // each tier name from the tier-wide (categoryless) policy where present,
    // else the tightest ceiling seen for that tier.
    const tierCeilingBps = new Map<string, number>();
    for (const policy of policies) {
      const current = tierCeilingBps.get(policy.tierCode);
      const isTierWide = policy.categoryId === null;
      if (isTierWide || current === undefined || policy.maxDiscountBps < current) {
        tierCeilingBps.set(policy.tierCode, policy.maxDiscountBps);
      }
    }
    for (const [tier, patterns] of [
      ["BRONZE", [/Bronze Tier/i]],
      ["SILVER", [/Silver Tier/i]],
      ["GOLD", [/Gold Tier/i]],
    ] as const) {
      const bps = tierCeilingBps.get(tier);
      if (bps === undefined) continue;
      const label = findByText(root, patterns[0], "div");
      const figure = label?.closest(".flex.items-center.justify-between")?.querySelector(".font-mono-metric.text-headline-sm");
      if (figure) writeText(figure, pct(bps));
    }
  }

  for (const pattern of [/Edit Tier Matrix/i, /Configure Rules/i]) {
    const button = findByText(root, pattern, "button");
    if (!button) continue;
    action(root, button, "View and edit discount ceilings", async () => {
      await openGovernancePanel(root);
      return "Opened the discount governance rules.";
    });
  }
}

// ----------------------------------------------------------- detail bindings

async function bindQuotationDetail(root: HTMLElement): Promise<void> {
  const quote = await api.get<Quotation>(`/quotes/${recordId()}`);

  replaceToken(root, /Q-1042/g, quote.code);
  replaceToken(root, /Acme Corp/g, quote.customer?.name ?? "—");
  setFigure(root, /^(Net Total|Grand Total|Total)$/i, money(quote.totalMinor, quote.currency));
  setFigure(root, /^(Subtotal|Gross)$/i, money(quote.subtotalMinor, quote.currency));
  setFigure(root, /^Discount/i, money(quote.discountMinor, quote.currency));
  setFigure(root, /Margin/i, pct(quote.marginBps));
  setFigure(root, /^Status$/i, titleCase(quote.status));

  const [tbody] = tbodies(root);
  if (tbody) {
    fillTable(
      tbody,
      quote.lines ?? [],
      (line) => ({
        1: [line.description, line.lineType],
        2: String(line.qty),
        3: money(line.unitPriceMinor, quote.currency),
        4: pct(line.discountBps),
        5: "—",
        6: line.lineType,
        7: money(line.lineTotalMinor, quote.currency),
      }),
      (row, line) => {
        const index = (quote.lines ?? []).indexOf(line) + 1;
        const first = row.querySelector("td");
        if (first) writeText(first, String(index));
      },
    );
  }

  action(root, findByText(root, /Submit for Approval/i, "button"), "Submit for approval", async () => {
    await api.post(`/quotes/${quote.id}/submit`);
    const evaluation = await api.post<{ riskLevel: string; requiredApprovals: string[] }>(`/quotes/${quote.id}/evaluate`);
    await bindQuotationDetail(root);
    return evaluation.requiredApprovals.length
      ? `Submitted. ${evaluation.riskLevel} risk — routed to ${evaluation.requiredApprovals.join(" then ")}.`
      : `Submitted. ${evaluation.riskLevel} risk — auto-approved, no sign-off needed.`;
  });

  action(root, findByText(root, /^(Confirm|Convert to Order)/i, "button"), "Confirm the order", async () => {
    const order = await api.post<Order>(`/quotes/${quote.id}/confirm`);
    return `Confirmed as ${order.code}.`;
  });

  const preview = findByText(root, /Preview Customer View/i, "a, button");
  if (preview) {
    const link = document.createElement("a");
    link.href = `/portal/quotations/${quote.code}/`;
    link.className = preview.className;
    link.innerHTML = preview.innerHTML;
    preview.replaceWith(link);
  }
}

async function bindApprovalDetail(root: HTMLElement): Promise<void> {
  const id = recordId();
  const approval = await api.get<ApprovalDetail>(`/approvals/${id}`);

  replaceToken(root, /Q-1042/g, approval.quotationCode);
  replaceToken(root, /Acme Corp/g, approval.customerName);
  setFigure(root, /Risk Score/i, `${approval.evaluation.riskScore} / 100 · ${approval.evaluation.riskLevel}`);
  setFigure(root, /^Status$/i, titleCase(approval.status));
  setFigure(root, /(Order Value|Total)/i, money(approval.total.amountMinor, approval.total.currency));
  setFigure(root, /Margin/i, pct(approval.evaluation.blended.marginBps));

  const quote = await api.get<Quotation>(`/quotes/${approval.quotationId}`);
  const ceilingByLine = new Map(approval.evaluation.lineCeilings.map((line) => [line.quoteLineId, line]));

  const [tbody] = tbodies(root);
  if (tbody) {
    fillTable(
      tbody,
      quote.lines ?? [],
      (line) => {
        const ceiling = ceilingByLine.get(line.id);
        return {
          0: line.description,
          1: String(line.qty),
          2: money(line.unitPriceMinor, quote.currency),
          3: pct(line.discountBps),
          4: ceiling ? pct(ceiling.allowedDiscountBps) : "—",
          5: ceiling && ceiling.overBps > 0 ? `+${pct(ceiling.overBps)} over` : "Within ceiling",
          6: ceiling && ceiling.overBps > 0 ? "Breach" : "Compliant",
        };
      },
      () => {},
    );
  }

  const decided = approval.status !== "PENDING";
  const notes = root.querySelector<HTMLTextAreaElement>("#review-notes");
  const decide = (act: "APPROVE" | "REJECT" | "RETURN", verb: string) => async () => {
    const reason = notes?.value.trim();
    if (act !== "APPROVE" && (!reason || reason.length < 3)) {
      throw new Error(`A reason is required to ${verb.toLowerCase()} — add one in the review notes.`);
    }
    const updated = await api.patch<ApprovalDetail>(`/approvals/${id}`, { action: act, ...(reason ? { reason } : {}) });
    await bindApprovalDetail(root);
    return updated.currentStep
      ? `${verb}. ${approval.quotationCode} now waits on ${titleCase(updated.currentStep)}.`
      : `${verb}. ${approval.quotationCode} is ${titleCase(updated.status)}.`;
  };

  for (const [selector, act, verb] of [
    ["#btn-approve", "APPROVE", "Approved"],
    ["#btn-reject", "REJECT", "Rejected"],
    ["#btn-return", "RETURN", "Returned to the rep"],
  ] as const) {
    const button = root.querySelector<HTMLElement>(selector);
    if (!button) continue;
    if (decided) {
      button.dataset.unavailable = `This request is already ${titleCase(approval.status)}.`;
      button.setAttribute("aria-disabled", "true");
      continue;
    }
    action(root, button, verb, decide(act, verb));
  }
}

async function bindWarehouseAllocation(root: HTMLElement): Promise<void> {
  const order = await api.get<Order>(`/orders/${recordId()}`);
  const plan = await api.get<AllocationPlan>(`/orders/${order.id}/allocation-plan`);

  replaceToken(root, /ORD-2291/g, order.code);
  replaceToken(root, /Acme Corp/g, order.quotation?.customer?.name ?? "—");
  setFigure(root, /^Status$/i, titleCase(order.status));
  setFigure(root, /(Order Value|Total)/i, money(order.totalMinor, order.currency));

  const nameByProduct = new Map((order.lines ?? []).map((line) => [line.productId, line.description]));
  const [tbody] = tbodies(root);
  if (tbody) {
    fillTable(
      tbody,
      plan.allocations,
      (allocation) => ({
        0: allocation.warehouseName,
        1: `${allocation.qty} × ${nameByProduct.get(allocation.productId) ?? "line item"}`,
        2: `${allocation.shipments} shipment(s)`,
        3: money(allocation.shippingCost.amountMinor, allocation.shippingCost.currency),
        4: "—",
        5: "—",
      }),
      () => {},
    );
  }

  const short = plan.backorder.reduce((sum, line) => sum + line.qty, 0);
  showBanner(
    root,
    short > 0
      ? `${short} unit(s) backordered — the rest ships from ${plan.allocations.length} depot(s) at ${money(plan.totalShippingCost.amountMinor, plan.totalShippingCost.currency)} freight.`
      : `Every line allocated across ${plan.allocations.length} depot(s), ${plan.totalShipments} shipment(s), ${money(plan.totalShippingCost.amountMinor, plan.totalShippingCost.currency)} freight.`,
    short > 0 ? "error" : "info",
  );

  const accept = action(root, findByText(root, /Accept Suggested Split|^(Reserve|Approve Split|Commit)/i, "button"), "Reserve stock against this plan", async () => {
    await api.post(`/orders/${order.id}/reserve`);
    await bindWarehouseAllocation(root);
    return `Stock reserved for ${order.code}.`;
  });
  action(root, findByText(root, /^(Release|Cancel Reservation)/i, "button"), "Release the reservation", async () => {
    await api.post(`/orders/${order.id}/release`);
    return `Reservation released for ${order.code}.`;
  });

  // The fulfilment state machine is what actually moves an order towards
  // billing, and the design never drew a control for it. Offer exactly the one
  // legal next step, beside the plan it applies to.
  const fulfillments = await api.get<Paginated<Fulfillment>>(`/fulfillments?orderId=${order.id}`);
  const current = fulfillments.items[0];
  const advanceTo = current ? NEXT_FULFILMENT[current.status] : undefined;
  if (!current || !accept?.parentElement) return;

  // These binders re-run after every successful action, so an injected control
  // must replace itself rather than stack up a new copy each time.
  root.querySelector("[data-df-advance]")?.remove();
  const advance = document.createElement("button");
  advance.type = "button";
  advance.dataset.dfAdvance = "true";
  advance.className =
    "w-full mt-space-xs inline-flex items-center justify-center gap-space-xxs border-[2px] border-outline bg-surface-container-lowest px-space-sm py-2 font-label-md text-label-md";
  advance.textContent = advanceTo
    ? `Move to ${titleCase(advanceTo)}`
    : `Fulfilment complete (${titleCase(current.status)})`;
  accept.parentElement.append(advance);

  if (!advanceTo) {
    advance.dataset.unavailable = `${order.code} has reached ${titleCase(current.status)} — there is no next step.`;
    advance.title = advance.dataset.unavailable;
    return;
  }
  action(root, advance, `Move to ${titleCase(advanceTo)}`, async () => {
    await api.patch(`/fulfillments/${current.id}`, { status: advanceTo });
    await bindWarehouseAllocation(root);
    return `${order.code} is now ${titleCase(advanceTo)}.`;
  });
}

async function bindInvoiceDetail(root: HTMLElement): Promise<void> {
  const invoice = await api.get<Invoice>(`/invoices/${recordId()}`);
  const outstanding = invoice.totalMinor - invoice.paidMinor;

  replaceToken(root, /INV-1042/g, invoice.id.slice(-8).toUpperCase());
  replaceToken(root, /Acme Corp/g, invoice.customerName);
  setFigure(root, /^Status$/i, titleCase(invoice.status));
  setFigure(root, /(Grand Total|Total Due|Invoice Total)/i, money(invoice.totalMinor, invoice.currency));
  setFigure(root, /Paid/i, money(invoice.paidMinor, invoice.currency));
  setFigure(root, /(Balance|Outstanding)/i, money(outstanding, invoice.currency));

  const amountById = new Map((invoice.lines ?? []).map((line) => [line.orderLineId, line.amountMinor]));
  const billed = (invoice.orderLines ?? []).filter((line) => amountById.has(line.id));

  const [tbody] = tbodies(root);
  if (tbody) {
    fillTable(
      tbody,
      billed,
      (line) => ({
        0: line.description,
        1: String(line.qty),
        2: money(line.unitPriceMinor, invoice.currency),
        3: pct(line.discountBps),
        4: money(amountById.get(line.id) ?? line.lineTotalMinor, invoice.currency),
      }),
      () => {},
    );
  }

  const amount = root.querySelector<HTMLInputElement>("#payment-amount");
  const method = root.querySelector<HTMLSelectElement>("#settlement-method");
  const reference = root.querySelector<HTMLInputElement>("#ref-utr");
  for (const control of [amount, method, reference]) {
    if (!control) continue;
    control.disabled = false;
    control.removeAttribute("title");
  }
  if (amount) {
    amount.value = (outstanding / 100).toFixed(2);
    amount.max = (outstanding / 100).toFixed(2);
  }

  let submit = root.querySelector<HTMLElement>("#btn-submit-payment");
  const settled = outstanding <= 0;
  if (submit && settled) {
    submit.dataset.unavailable = "This invoice is settled in full.";
    submit.setAttribute("aria-disabled", "true");
  } else {
    submit = action(root, submit, "Record this payment", async () => {
      const amountMinor = Math.round(Number(amount?.value ?? 0) * 100);
      if (!Number.isFinite(amountMinor) || amountMinor <= 0) throw new Error("Enter an amount greater than zero.");
      if (amountMinor > outstanding) throw new Error(`That is more than the ${money(outstanding, invoice.currency)} outstanding.`);
      const updated = await api.post<Invoice>(`/invoices/${invoice.id}/payments`, {
        amountMinor,
        method: method?.value || "BANK_TRANSFER",
        reference: reference?.value || `WEB-${Date.now()}`,
      });
      await bindInvoiceDetail(root);
      return `Payment recorded. Invoice is now ${titleCase(updated.status)}.`;
    }) ?? submit;
  }

  // The payment form posts through the button; stop the designed submit handler
  // from also firing and reporting a success nothing performed.
  root.querySelector<HTMLFormElement>("#record-payment-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    submit?.dispatchEvent(new Event("click"));
  });
}

async function bindSubscriptionDetail(root: HTMLElement): Promise<void> {
  const id = recordId();
  const subscription = await api.get<Subscription>(`/subscriptions/${id}`);

  replaceToken(root, /SUB-4012/g, subscription.id.slice(-8).toUpperCase());
  replaceToken(root, /Acme Corp/g, subscription.customerName);
  setFigure(root, /^Status$/i, titleCase(subscription.status));
  setFigure(root, /(MRR|Recurring|Billed Amount)/i, money(subscription.amountMinor, subscription.currency));
  setFigure(root, /Next/i, shortDate(subscription.schedules?.[0]?.dueAt));

  const [linesBody, scheduleBody] = tbodies(root);
  if (linesBody) {
    fillTable(
      linesBody,
      subscription.orderLines ?? [],
      (line) => ({
        0: line.description,
        1: String(line.qty),
        2: money(line.unitPriceMinor, subscription.currency),
        3: pct(line.discountBps),
        4: money(line.lineTotalMinor, subscription.currency),
        5: "Recurring",
      }),
      () => {},
    );
  }
  if (scheduleBody) {
    fillTable(
      scheduleBody,
      subscription.schedules ?? [],
      (schedule) => ({
        0: `Cycle due ${shortDate(schedule.dueAt)}`,
        1: subscription.cadenceMonths === 1 ? "Monthly" : `Every ${subscription.cadenceMonths} months`,
        2: "—",
        3: money(schedule.amountMinor, schedule.currency),
        4: shortDate(schedule.dueAt),
        5: schedule.invoiceId ? "Invoiced" : "Scheduled",
      }),
      () => {},
    );
  }

  const transitions: [RegExp, string, string][] = [
    [/^Pause/i, "PAUSED", "Paused"],
    [/^(Resume|Reactivate)/i, "ACTIVE", "Reactivated"],
    [/^Cancel/i, "CANCELLED", "Cancelled"],
  ];
  for (const [pattern, status, verb] of transitions) {
    const button = findByText(root, pattern, "button");
    if (!button || subscription.status === status) continue;
    action(root, button, `${verb} this subscription`, async () => {
      await api.patch(`/subscriptions/${id}`, { status });
      await bindSubscriptionDetail(root);
      return `${verb}.`;
    });
  }

  // "Download Billing PDF" builds a printable summary from the data already on
  // screen — there is no server PDF endpoint, so this is an honest generated
  // document, same approach as the CSV exports.
  const cadence = subscription.cadenceMonths === 1 ? "Monthly" : `Every ${subscription.cadenceMonths} months`;
  action(root, findByText(root, /Download Billing PDF/i, "button"), "Download a billing summary document", async () => {
    downloadDocument(
      `subscription-${subscription.id.slice(-8)}`,
      `Subscription billing summary`,
      [
        ["Subscription", subscription.id.slice(-8).toUpperCase()],
        ["Customer", subscription.customerName],
        ["Order", subscription.orderCode],
        ["Status", titleCase(subscription.status)],
        ["Cadence", cadence],
        ["Amount per cycle", money(subscription.amountMinor, subscription.currency)],
        ["Next due", shortDate(subscription.schedules?.[0]?.dueAt)],
      ],
      {
        head: ["Cycle due", "Cadence", "Amount", "State"],
        body: (subscription.schedules ?? []).map((schedule) => [
          shortDate(schedule.dueAt),
          cadence,
          money(schedule.amountMinor, schedule.currency),
          schedule.invoiceId ? "Invoiced" : "Scheduled",
        ]),
      },
    );
    return "Generated a billing summary document.";
  });
}

async function bindCustomerQuotation(root: HTMLElement): Promise<void> {
  // bindLogin sends a customer with no quotes to /portal/quotations/none/, so
  // the portal has somewhere honest to land rather than 404ing on an empty
  // account. Say so plainly instead of trying to fetch a quote called "none".
  if (recordId() === "none") {
    clearDemoData(root);
    showBanner(root, "You have no quotations yet. The deal desk will share one here when it is ready.", "info");
    return;
  }
  const quote = await api.get<Quotation>(`/quotes/${recordId()}`);

  replaceToken(root, /Q-1042/g, quote.code);
  replaceToken(root, /Acme Corp(oration)?/g, quote.customer?.name ?? "—");
  replaceToken(root, /₹14,637\.90/g, money(quote.totalMinor, quote.currency));
  setFigure(root, /(Grand Total|Total)/i, money(quote.totalMinor, quote.currency));
  setFigure(root, /(Valid|Expiry)/i, shortDate(quote.validUntil));

  const [tbody] = tbodies(root);
  if (tbody) {
    fillTable(
      tbody,
      quote.lines ?? [],
      (line) => ({
        1: line.description,
        2: String(line.qty),
        3: money(line.unitPriceMinor, quote.currency),
        4: pct(line.discountBps),
        5: money(line.lineTotalMinor, quote.currency),
        6: titleCase(quote.status),
      }),
      (row, line) => {
        const index = (quote.lines ?? []).indexOf(line) + 1;
        const first = row.querySelector("td");
        if (first) writeText(first, String(index));
      },
    );
  }

  // ---- the negotiation thread, loaded from the server so it survives reload --
  const thread = root.querySelector<HTMLElement>("#dynamicMessages");
  const renderThread = (messages: NegotiationMessage[]) => {
    if (!thread) return;
    if (!messages.length) {
      thread.innerHTML =
        '<p class="font-body-sm text-body-sm text-on-surface-variant">No messages yet. Send a note to the deal desk below.</p>';
      return;
    }
    thread.replaceChildren(
      ...messages.map((message) => {
        const wrap = document.createElement("div");
        wrap.className = "flex flex-col items-start";
        const meta = document.createElement("div");
        meta.className = "flex items-center gap-space-xs mb-1 font-mono-metric-sm text-mono-metric-sm text-on-surface-variant";
        const ask = message.requestedDiscountBps != null ? ` · requested ${pct(message.requestedDiscountBps)}` : "";
        meta.textContent = `Deal desk thread · ${relative(message.createdAt)}${ask}`;
        const bubble = document.createElement("div");
        bubble.className =
          "bg-[#E0E7FA] border-[1.5px] border-[#1D2430] p-space-sm max-w-xl text-[#1D2430] font-body-md text-body-md shadow-sm";
        bubble.textContent = message.body;
        wrap.append(meta, bubble);
        return wrap;
      }),
    );
  };

  const loadThread = async () => {
    const data = await api.get<NoteThread>(`/quotes/${quote.id}/notes`).catch(() => null);
    renderThread(data?.messages ?? []);
  };
  await loadThread();

  // ---- Send Note: POST a real NegotiationMessage --------------------------
  const composer = root.querySelector<HTMLTextAreaElement>("#concessionInput");
  action(root, root.querySelector<HTMLElement>("#sendNoteBtn"), "Send this note to the deal desk", async () => {
    const bodyText = composer?.value.trim();
    if (!bodyText) {
      composer?.focus();
      throw new Error("Type a note before sending.");
    }
    await api.post(`/quotes/${quote.id}/notes`, { body: bodyText });
    if (composer) composer.value = "";
    await loadThread();
    return "Note sent to the deal desk.";
  });

  // ---- Accept & Sign: POST /accept, driven from inside the sign modal -----
  const confirmSign = root.querySelector<HTMLElement>("#confirmSignBtn");
  const signButton = root.querySelector<HTMLButtonElement>("#signQuotationBtn");
  const wired = action(root, confirmSign, "Accept and sign this quotation", async () => {
    await api.post(`/quotes/${quote.id}/accept`);
    root.querySelector("#signModal")?.classList.add("hidden");
    if (signButton) {
      signButton.textContent = "Quotation Accepted & Signed";
      signButton.disabled = true;
      signButton.classList.add("cursor-default", "opacity-80");
    }
    await loadThread();
    return `You accepted ${quote.code}. The deal desk has been notified.`;
  });
  // The page's own modal open/close listeners on #signQuotationBtn/#closeModalBtn
  // survive because we only replaced #confirmSignBtn.
  void wired;

  // ---- Download PDF: a generated document, built in-browser ---------------
  action(root, root.querySelector<HTMLElement>("#downloadPdfBtn"), "Download this quotation as a document", async () => {
    downloadDocument(
      `${quote.code}-quotation`,
      `Quotation ${quote.code}`,
      [
        ["Customer", quote.customer?.name ?? "—"],
        ["Status", titleCase(quote.status)],
        ["Currency", quote.currency],
        ["Subtotal", money(quote.subtotalMinor, quote.currency)],
        ["Discount", money(quote.discountMinor, quote.currency)],
        ["Total", money(quote.totalMinor, quote.currency)],
        ["Valid until", shortDate(quote.validUntil)],
      ],
      {
        head: ["#", "Item", "Qty", "Unit price", "Discount", "Line total"],
        body: (quote.lines ?? []).map((line, index) => [
          String(index + 1),
          line.description,
          String(line.qty),
          money(line.unitPriceMinor, quote.currency),
          pct(line.discountBps),
          money(line.lineTotalMinor, quote.currency),
        ]),
      },
    );
    return `Generated a document for ${quote.code}.`;
  });
}

// ------------------------------------------------------------------- sign in

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
      // Route by the authenticated role, not the toggle. The toggle is a hint;
      // the token's role is the authority, so a customer account always lands on
      // its own portal and an internal account always lands in the workspace -
      // whichever way the toggle happens to be set. (portal is read here only to
      // keep the linter happy about the toggle wiring; the decision is the role.)
      void portal;
      const who = await auth.me();
      if (who?.role === "CUSTOMER") {
        const mine = await api
          .get<Paginated<Quotation>>("/quotes?pageSize=1")
          .catch(() => null);
        const first = mine?.items[0];
        window.location.assign(first ? `/portal/quotations/${first.code}/` : "/portal/quotations/none/");
      } else {
        window.location.assign("/dashboard/");
      }
    } catch (error) {
      submit.disabled = false;
      say(mode === "signup" ? "Sign Up" : "Sign In");
      feedback.textContent = (error as Error).message;
    } finally {
      form.setAttribute("aria-busy", "false");
    }
  });
}

// --------------------------------------------------------------------- entry

const BINDERS: Partial<Record<PageName, (root: HTMLElement) => void | Promise<void>>> = {
  login: bindLogin,
  dashboard: bindDashboard,
  quotations: bindQuotations,
  "quotation-detail": bindQuotationDetail,
  approvals: bindApprovals,
  "approval-detail": bindApprovalDetail,
  fulfillment: bindFulfillment,
  "warehouse-allocation": bindWarehouseAllocation,
  subscriptions: bindSubscriptions,
  "subscription-billing": bindSubscriptionDetail,
  invoices: bindInvoices,
  "invoice-detail": bindInvoiceDetail,
  "deal-health": bindDealHealth,
  reports: bindReports,
  "customer-quotation": bindCustomerQuotation,
};

/**
 * The portal is the only page a CUSTOMER session may see. Everything else is the
 * internal workspace, so a customer who lands on one (typed the URL, followed a
 * stale link) is sent back to their portal. The server already scopes every read
 * to the token's customerId (Part A); this is the UX half of the same wall - it
 * stops the internal chrome from ever painting for a customer.
 */
async function guardInternalPage(root: HTMLElement, page: PageName): Promise<boolean> {
  const who = await auth.me();
  if (who?.role !== "CUSTOMER") return true;

  const mine = await api.get<Paginated<Quotation>>("/quotes?pageSize=1").catch(() => null);
  const first = mine?.items[0];
  clearDemoData(root);
  showBanner(root, "This workspace is for internal staff. Returning you to your portal.", "info");
  window.location.assign(first ? `/portal/quotations/${first.code}/` : "/portal/quotations/none/");
  return false;
}

export function goLive(root: HTMLElement, page: PageName): void {
  // The portal wears its own header; the internal session box would duplicate
  // (and leak internal chrome onto) it, so mount a portal-shaped sign-out there
  // instead and never the internal one.
  if (page === "customer-quotation") void mountPortalSession(root).catch(() => {});
  else if (page !== "login") void mountSession(root).catch(() => {});

  const bind = BINDERS[page];
  if (!bind) return;

  if (page !== "login" && !isSignedIn()) {
    clearDemoData(root);
    return showBanner(root, "Sign in to load records.", "info");
  }

  // Close the isolation leak the user reported: a customer session must not be
  // able to reach the internal workspace, even by typing /dashboard/ directly.
  const internal = page !== "login" && page !== "customer-quotation";
  if (internal) {
    void guardInternalPage(root, page).then((allowed) => {
      if (allowed) runBinder(root, page, bind);
    });
    return;
  }
  runBinder(root, page, bind);
}

function runBinder(root: HTMLElement, page: PageName, bind: (root: HTMLElement) => void | Promise<void>): void {
  if (page !== "login") {
    clearDemoData(root);
    root.setAttribute("aria-busy", "true");
    tbodies(root).forEach((tbody) => showTableState(tbody, "Loading records…"));
  }

  void Promise.resolve(bind(root))
    .catch((error: Error) => {
      tbodies(root).forEach((tbody) => showTableState(tbody, "Records could not be loaded."));
      showBanner(root, error.message);
    })
    .finally(() => root.setAttribute("aria-busy", "false"));
}
