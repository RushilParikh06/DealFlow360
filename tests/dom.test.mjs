// Guards apps/web/lib/dom.ts against the two ways filling a designed table
// silently wrecks the design. Both of these shipped once:
//
//   1. the value landed inside a Material Symbols span, so the icon rendered as
//      literal words and the stale sample text survived next to it
//   2. writing textContent on a status chip deleted the coloured dot inside it
//
// Run with the rest: `pnpm test`.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><table><tbody></tbody></table>");
globalThis.document = dom.window.document;
globalThis.NodeFilter = dom.window.NodeFilter;

const { fillTable, money, titleCase } = await import("../apps/web/lib/dom.ts");

const tbody = document.querySelector("tbody");
const SAMPLE_ROW = `
  <tr data-sample="1">
    <td><a class="link" href="#">Q-SAMPLE</a></td>
    <td>
      <span class="chip">
        <span class="material-symbols-outlined">error</span>
        Discount +8pt OVER
      </span>
    </td>
    <td>
      <span class="chip">
        <span class="w-1.5 h-1.5 rounded-full bg-[#D97706]"></span>
        Pending Approval
      </span>
    </td>
    <td>
      <div class="title">Laptop Pro 14</div>
      <span class="subtitle">SKU: SAMPLE</span>
    </td>
    <td><button><span class="material-symbols-outlined">more_vert</span></button></td>
  </tr>`;

const reset = () => {
  tbody.innerHTML = SAMPLE_ROW;
  delete tbody.dataset.live;
};

// --- one row per record, design intact ---------------------------------------
reset();
fillTable(tbody, [{ code: "QT-1004" }, { code: "QT-1005" }], (r) => ({
  0: r.code,
  1: "Discount ₹9.60",
  2: "Auto Approved",
  3: ["RackServer R220", "SKU: HW-SRV-R220"],
}));

const rows = [...tbody.querySelectorAll("tr")];
assert.equal(rows.length, 2, "one row per record");
assert.equal(tbody.dataset.live, "true", "live tables must be visible after hydration");

const cells = rows[0].querySelectorAll("td");

assert.equal(cells[0].querySelector("a")?.textContent, "QT-1004", "code keeps its link element");
assert.equal(cells[0].querySelector("a")?.getAttribute("href"), null, "records must not inherit a sample detail URL");

const iconCell = cells[1];
assert.equal(
  iconCell.querySelector(".material-symbols-outlined").textContent,
  "error",
  "the icon ligature must survive - overwriting it renders words where the glyph was",
);
assert.match(iconCell.textContent, /Discount ₹9\.60/);
assert.doesNotMatch(iconCell.textContent, /\+8pt OVER/, "stale sample text must be gone");

const chipCell = cells[2];
assert.ok(chipCell.querySelector(".rounded-full"), "the status dot must survive");
assert.match(chipCell.textContent, /Auto Approved/);

const stacked = cells[3];
assert.equal(stacked.querySelector(".title").textContent, "RackServer R220");
assert.equal(stacked.querySelector(".subtitle").textContent, "SKU: HW-SRV-R220");

// A column left out of the map keeps the template's markup verbatim.
assert.ok(cells[4].querySelector("button"), "untouched columns keep their controls");

// --- empty result ------------------------------------------------------------
reset();
fillTable(tbody, [], () => ({}));
assert.equal(tbody.querySelectorAll("tr").length, 1);
assert.match(tbody.textContent, /No records/);
assert.equal(tbody.querySelector("td").getAttribute("colspan"), "5", "spans every column");

// --- money is never half-formatted -------------------------------------------
assert.equal(money(23040, "INR"), "₹230.40");
assert.equal(money(960, "INR"), "₹9.60");
assert.equal(money(0, "INR"), "₹0.00");
assert.equal(titleCase("PARTIALLY_PAID"), "Partially Paid");

console.log("DealFlow360 dom check passed: table hydration preserves icons, dots and untouched columns.");
