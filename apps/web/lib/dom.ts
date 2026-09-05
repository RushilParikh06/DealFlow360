// F owned. Fills the designed HTML with real rows instead of rebuilding it.
//
// The pages ship as finished markup with hand-written sample rows. Rather than
// re-authoring every table in React, we keep the first sample row as the
// template, clone it per record and rewrite the text inside each cell. The
// design (chips, borders, mono columns) survives untouched.

/**
 * Minor units -> "₹12,400.00". Both decimals always: a money column where one
 * row reads ₹230.4 and the next ₹230.40 is a bug report waiting to happen, and
 * the amounts stop aligning under tabular-nums.
 */
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
 * The words inside a cell, in document order, ignoring decoration.
 *
 * Two kinds of node must never be treated as content. A Material Symbols span
 * holds a ligature name ("error", "check_circle") that the font renders as a
 * glyph - write a value into it and you get literal garbled words where the
 * icon was. And an empty span is usually a status dot or a rule, carrying its
 * meaning entirely in its classes.
 */
function contentNodes(cell: Element): Text[] {
  const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (!text.data.trim()) continue;
    if (text.parentElement?.classList.contains("material-symbols-outlined")) continue;
    nodes.push(text);
  }
  return nodes;
}

/**
 * Rewrites the words in a cell while leaving every element untouched, so a chip
 * keeps its status dot, a code keeps its link styling and an icon stays an icon.
 *
 * Many cells stack two lines - a code above a subtitle, a customer above a
 * tier. Pass an array to fill them in order; pass a string to fill only the
 * first and leave the rest of the design alone.
 */
function writeCell(cell: Element, value: string | string[]): void {
  const values = Array.isArray(value) ? value : [value];
  const nodes = contentNodes(cell);

  if (nodes.length === 0) {
    cell.textContent = values.join(" ");
    return;
  }
  values.forEach((text, index) => {
    if (nodes[index]) nodes[index].data = text;
  });
}

/**
 * Replaces a tbody's sample rows with one row per record.
 *
 * `cells` maps a column index to the text for that column. Columns left out of
 * the map keep whatever the template row had, which is how action buttons and
 * decorative columns survive.
 */
export function fillTable<T>(
  tbody: HTMLElement,
  records: T[],
  cells: (record: T) => Record<number, string | string[] | undefined>,
  onRow?: (row: HTMLElement, record: T) => void,
): void {
  const template = tbody.querySelector("tr");
  if (!template) return;

  // globals.css hides every sample row past the third to keep a demo screen
  // readable. Real results must not be capped at three, so mark the table live.
  tbody.dataset.dfLive = "true";

  if (records.length === 0) {
    const columns = template.querySelectorAll("td").length || 1;
    tbody.innerHTML = `<tr><td colspan="${columns}" class="py-space-lg px-space-md text-center font-mono-metric-sm text-on-surface-variant uppercase">No records</td></tr>`;
    return;
  }

  const rows = records.map((record) => {
    const row = template.cloneNode(true) as HTMLElement;
    const tds = row.querySelectorAll("td");
    const values = cells(record);
    for (const [index, value] of Object.entries(values)) {
      const cell = tds[Number(index)];
      if (cell && value !== undefined) writeCell(cell, value);
    }
    onRow?.(row, record);
    return row;
  });

  tbody.replaceChildren(...rows);
}

/**
 * Pages are static exports, so a failed call must not leave a half-built
 * screen: the designed sample rows stay and a banner says the data is stale.
 */
export function showBanner(root: HTMLElement, message: string, tone: "error" | "info" = "error"): void {
  const banner = document.createElement("div");
  banner.dataset.dfBanner = "true";
  banner.className =
    tone === "error"
      ? "bg-error-container text-on-error-container border-b-[1.5px] border-error px-space-md py-space-xs font-mono-metric-sm text-mono-metric-sm uppercase tracking-wider"
      : "bg-primary-container text-on-primary-container border-b-[1.5px] border-outline px-space-md py-space-xs font-mono-metric-sm text-mono-metric-sm uppercase tracking-wider";
  banner.textContent = message;
  root.prepend(banner);
}
