/**
 * Drives the API through the parts of the demo the seed cannot reach.
 *
 * Risk scoring, approval routing and the deal-health sweep are engine
 * behaviour, not rows: writing approval chains straight into Postgres from the
 * seed would mean a second, drifting copy of the routing rules. So the seed
 * lays down quotes and billing, and this script asks the running API to
 * evaluate them - the same call the demo makes on stage.
 *
 * Usage: pnpm db:demo   (with the API up on :3001)
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const EMAIL = process.env.DEMO_EMAIL ?? 'admin@dealflow.test';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'dealflow123';

let token = '';

async function call(path, init = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  }).catch(() => {
    throw new Error(`Cannot reach the API at ${BASE}. Start it with "pnpm dev:api" first.`);
  });

  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new Error(`${init.method ?? 'GET'} ${path} -> ${response.status} ${body?.error?.message ?? ''}`.trim());
  }
  return body.data;
}

const tokens = await call('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
token = tokens.accessToken;
console.log(`signed in as ${EMAIL}`);

// ---- evaluate every quote that is waiting on a decision ---------------------
const { items: quotes } = await call('/quotes?pageSize=100');
const pending = quotes.filter((quote) => quote.status === 'SUBMITTED');

for (const quote of pending) {
  const evaluation = await call(`/quotes/${quote.id}/evaluate`, { method: 'POST' });
  const route = evaluation.requiredApprovals.length ? evaluation.requiredApprovals.join(' -> ') : 'auto-approved';
  console.log(`  ${quote.code}  score ${evaluation.riskScore} ${evaluation.riskLevel}  ${route}`);
}
if (pending.length === 0) console.log('  every quote is already evaluated');

// ---- refresh deal health ----------------------------------------------------
const sweep = await call('/deal-health/refresh', { method: 'POST' });
console.log(`deal health: scanned ${sweep.scanned}, ${sweep.findings} findings`);

const approvals = await call('/approvals?pageSize=100');
console.log(`approval queue: ${approvals.total} waiting`);
console.log('\ndemo state ready.');
