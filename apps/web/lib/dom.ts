// F owned. Fills the designed HTML with real rows instead of rebuilding it.

const tableTemplates = new WeakMap<HTMLElement, HTMLTableRowElement>();

function templateFor(tbody: HTMLElement): HTMLTableRowElement | undefined {
  let template = tableTemplates.get(tbody);
  if (!template) {
    const first = tbody.querySelector<HTMLTableRowElement>("tr");
    if (first) {
      template = first.cloneNode(true) as HTMLTableRowElement;
      tableTemplates.set(tbody, template);
    }
  }
  return template;
}

/** Minor units -> "₹12,400". Money never becomes a float on the way through. */
export function money(amountMinor: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function relative(value: string | null | undefined): string {
  if (!value) return "—";
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

/** SCREAMING_SNAKE status codes read badly in a designed chip. */
export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Writes into the innermost element that already carries text, so a status
 * cell keeps its chip markup and a code cell keeps its link styling. Cells
 * with a code on top and a subtitle underneath keep the subtitle.
 */
function writeCell(cell: Element, value: string | string[]): void {
  cell.setAttribute("data-record-value", "true");
  const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
  const nodes: Node[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.textContent?.trim() && !node.parentElement?.closest(".material-symbols-outlined")) nodes.push(node);
  }
  const values = Array.isArray(value) ? value : [value];
  nodes.forEach((node, index) => { node.textContent = values[index] ?? ""; });
  if (!nodes.length) cell.append(document.createTextNode(values.join(" · ")));
}

/**
 * Replaces a tbody's hidden structural row with one row per record.
 *
 * `cells` maps a column index to the text for that column. Columns left out of
 * the map are cleared unless they contain an action control.
 */
export function fillTable<T>(
  tbody: HTMLElement,
  records: T[],
  cells: (record: T) => Record<number, string | string[] | undefined>,
  onRow?: (row: HTMLElement, record: T) => void,
): void {
  const template = templateFor(tbody);
  if (!template) return;

  tbody.dataset.live = "true";
  const selection = tbody.closest("table")?.querySelector<HTMLInputElement>('thead input[type="checkbox"]');
  if (selection) { selection.checked = false; selection.indeterminate = false; }

  if (records.length === 0) {
    return showTableState(tbody);
  }

  const rows = records.map((record, rowIndex) => {
    const row = template.cloneNode(true) as HTMLElement;
    row.classList.add("df-live-row");
    const tds = row.querySelectorAll("td");
    const values = cells(record);
    for (const [index, cell] of [...tds].entries()) {
      const value = values[index];
      if (value !== undefined) writeCell(cell, value);
      else if (!cell.querySelector('button, a[href], input[type="checkbox"]')) cell.textContent = "—";
    }
    row.querySelector('input[type="checkbox"]')?.setAttribute("aria-label", `Select row ${rowIndex + 1}`);
    // A cloned template must not open or act on its original sample record.
    if (!onRow) {
      for (const control of row.querySelectorAll<HTMLElement>("a, button")) {
        control.dataset.unavailable = "Details and actions for this record are not connected yet.";
        control.setAttribute("aria-disabled", "true");
        control.title = control.dataset.unavailable;
        if (control.tagName === "A") control.removeAttribute("href");
      }
    }
    onRow?.(row, record);
    return row;
  });

  tbody.replaceChildren(...rows);
  updateRecordCount(tbody, `${records.length} records loaded`);
}

function updateRecordCount(tbody: HTMLElement, message: string): void {
  const id = tbody.closest("table")?.id;
  if (!id) return;
  for (const count of document.querySelectorAll<HTMLElement>("[data-record-count]")) {
    if (count.dataset.recordCount === id) count.textContent = message;
  }
}

export function showTableState(tbody: HTMLElement, message = "No records"): void {
  const columns = templateFor(tbody)?.querySelectorAll("td").length || 1;
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = columns;
  cell.className = "py-space-lg px-space-md text-left font-mono-metric-sm text-on-surface-variant uppercase";
  cell.textContent = message;
  row.append(cell);
  tbody.dataset.live = "true";
  tbody.replaceChildren(row);
  updateRecordCount(tbody, message);
}

/** Removes designed placeholder records before authentication or API calls. */
export function clearDemoData(root: HTMLElement): void {
  for (const tbody of root.querySelectorAll<HTMLElement>("tbody")) showTableState(tbody);
  for (const list of root.querySelectorAll<HTMLElement>("[data-entry-list]")) {
    const empty = document.createElement("div");
    empty.className = "p-space-md text-center font-mono-metric-sm text-on-surface-variant uppercase";
    empty.textContent = "No records";
    list.dataset.live = "true";
    list.replaceChildren(empty);
  }
}

/**
 * Pages are static exports, so API failures are shown without fabricating data.
 */
export function showBanner(root: HTMLElement, message: string, tone: "error" | "info" = "error"): void {
  root.querySelector("[data-df-banner]")?.remove();
  const banner = document.createElement("div");
  banner.dataset.dfBanner = "true";
  banner.setAttribute("role", tone === "error" ? "alert" : "status");
  banner.className =
    tone === "error"
      ? "bg-error-container text-on-error-container border-b-[1.5px] border-error px-space-md py-space-xs font-mono-metric-sm text-mono-metric-sm uppercase tracking-wider"
      : "bg-primary-container text-on-primary-container border-b-[1.5px] border-outline px-space-md py-space-xs font-mono-metric-sm text-mono-metric-sm uppercase tracking-wider";
  banner.textContent = message;
  (root.querySelector('[role="dialog"]:not(.hidden) > div') ?? root.querySelector("main") ?? root).prepend(banner);
}
