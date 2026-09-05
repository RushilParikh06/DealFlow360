import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const dom = new JSDOM('<!doctype html><div id="root"><main><button id="open">Open</button><div id="modal" class="fixed inset-0 hidden"><h2>Review</h2><button id="close">Close</button><input aria-label="Name"></div><button data-unavailable="Not connected" id="fake">Pay</button></main></div>', { url: 'http://localhost' });
for (const key of ['window','document','HTMLElement','NodeFilter','MutationObserver']) globalThis[key] = dom.window[key];
dom.window.HTMLElement.prototype.scrollIntoView = function () {};
const table = await import('../apps/web/lib/dom.ts');
function load(name, overrides) {
  const source = readFileSync(new URL(`../apps/web/lib/${name}.ts`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require','module','exports',compiled)(id => overrides[id] ?? require(id), module, module.exports);
  return module.exports;
}
const { wireAccessibility } = load('ui', { './dom': table });
const root = document.querySelector('#root');
let cleanup = wireAccessibility(root);
cleanup(); cleanup = wireAccessibility(root); // React strict-mode effect replay.
assert.equal(root.querySelectorAll('.df-skip-link').length, 1);
let mutation = false;
root.querySelector('#fake').addEventListener('click', () => mutation = true);
root.querySelector('#fake').click();
assert.equal(mutation, false, 'unconnected controls cannot claim a payment was saved');
assert.equal(root.querySelector('[data-df-banner]')?.parentElement.tagName, 'MAIN');
root.querySelector('#open').focus();
const modal = root.querySelector('#modal');
modal.classList.remove('hidden');
await Promise.resolve();
assert.equal(modal.getAttribute('role'), 'dialog');
assert.equal(document.activeElement.id, 'close');
assert.equal(root.querySelector('#open').inert, true);
modal.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
assert.equal(modal.classList.contains('hidden'), true);
assert.equal(document.activeElement.id, 'open');
assert.ok(!root.querySelector('#open').inert);
cleanup();

for (const file of readdirSync(new URL('../pages/', import.meta.url))) {
  if (!file.endsWith('.html')) continue;
  const d = new JSDOM(readFileSync(new URL('../pages/'+file, import.meta.url), 'utf8')).window.document;
  for (const input of d.querySelectorAll('input,select,textarea')) assert.ok(input.labels.length || input.getAttribute('aria-label'), `${file}: unnamed ${input.outerHTML}`);
  for (const button of d.querySelectorAll('button')) {
    const copy = button.cloneNode(true);
    copy.querySelectorAll('.material-symbols-outlined').forEach(e => e.remove());
    assert.ok(copy.textContent.trim() || button.getAttribute('aria-label'), `${file}: unnamed icon button`);
  }
}

const approvalSource = readFileSync(new URL('../pages/approvals.html', import.meta.url), 'utf8');
const approvalDom = new JSDOM(approvalSource);
globalThis.document = approvalDom.window.document;
const requests = [];
const api = { get: async path => {
  requests.push(path);
  return { total:18, page:Number(new URL(path,'http://localhost').searchParams.get('page') || 1), pageSize:6, items: Array.from({length:6}, (_,i) => ({ id:String(i),quotationCode:`Q-${i}`,customerName:'Customer',riskLevel:'LOW',riskScore:2,currentStep:'FINANCE',total:{amountMinor:123400,currency:'INR'},createdAt:new Date().toISOString() })) };
} };
const routes = { recordIdFromPath: () => undefined };
const { goLive } = load('live', {
  './dom': table,
  './routes': routes,
  // mountSession runs on every non-login page; signed out is the quiet path.
  './api': { api, isSignedIn: () => true, auth: { me: async () => null }, clearTokens() {}, saveTokens() {} },
});
goLive(document.body, 'approvals');
await new Promise(resolve => setTimeout(resolve, 0));
const rows = document.querySelectorAll('tbody tr');
assert.equal(rows.length,6);
assert.match(rows[0].children[1].textContent,/Q-0/);
assert.match(rows[0].children[2].textContent,/Customer/);
assert.match(rows[0].children[3].textContent,/LOW/);
assert.match(rows[0].children[4].textContent,/₹1,234.00/, 'the value column shows the request total');
assert.match(rows[0].children[5].textContent,/Finance/);
const cleanupSelection = wireAccessibility(document.body);
const selectAll = document.querySelector('thead input[type="checkbox"]');
selectAll.click();
assert.ok([...document.querySelectorAll('tbody input[type="checkbox"]')].every(input => input.checked));
rows[0].querySelector('input[type="checkbox"]').click();
assert.equal(selectAll.indeterminate, true);
document.querySelector('[data-pagination] button:last-child').click();
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(selectAll.checked, false);
assert.equal(selectAll.indeterminate, false);
cleanupSelection();
document.querySelector('[data-pagination] button:last-child').click();
await new Promise(resolve => setTimeout(resolve, 0));
assert.match(requests.at(-1), /page=3$/);
assert.equal(document.querySelector('[data-pagination] button:last-child').disabled, true);
const search = document.querySelector('main input[placeholder*="Search"]');
search.value = 'no match'; search.oninput(new Event('input'));
assert.match(document.querySelector('tbody').textContent, /No matching records/);
search.value = 'Q-3'; search.oninput(new Event('input'));
assert.equal(document.querySelectorAll('tbody tr').length, 1);
assert.match(document.querySelector('tbody').textContent, /Q-3/);
console.log('UI regression checks passed: labels, table mapping, preview action guard, dialog focus, Escape, strict-mode cleanup.');
