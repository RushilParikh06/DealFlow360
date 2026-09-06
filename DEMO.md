# DealFlow360 — demo script

A two-sided walkthrough: the **internal staff workspace** (deal desk, approvals,
fulfilment, billing, governance) and the **customer portal** (a buyer reviewing,
negotiating and signing their own quote). Everything below runs against seeded
data — the numbers on screen are the numbers the unit tests assert.

## 0. Start from a clean slate

```bash
pnpm db:reset
```

`db:reset` reseeds the base data and demo quotes, then runs the engine pipeline
so risk evaluations and approval chains exist. Then bring both servers up:

```bash
pnpm go
```

- API: http://localhost:3001/api/v1
- Web: http://localhost:3000

Every seeded account uses the password **`dealflow123`**.

| Account | Role | Lands on |
| --- | --- | --- |
| `admin@dealflow.test` | ADMIN | Internal workspace |
| `manager@dealflow.test` | Sales Manager | Internal workspace |
| `rep@dealflow.test` | Sales Rep | Internal workspace |
| `finance@dealflow.test` | Finance | Internal workspace |
| `buyer@meridian.test` | Customer (Meridian Logistics) | Customer portal |

The login page role toggle ("Internal Staff Workspace" / "Customer Portal
Access") is only a hint. Routing is decided by the account's real role, so a
customer account always lands on the portal and an internal account always lands
in the workspace — whichever way the toggle is set.

---

## 1. Internal side — `manager@dealflow.test`

Sign in. You land on the **dashboard**: open-quotation count, pending approvals,
at-risk deals, and a live audit feed.

### 1a. Submit and evaluate the hero quote (QT-1001)

1. Go to **Quotations** → open **QT-1001** (Meridian Logistics).
2. Press **Submit for Approval**. The quote is submitted and evaluated in one
   step. Expect: **HIGH** risk, routed to **Sales Manager → Finance** (blended
   excess 460 bps, worst line 800 bps, margin 1140 bps, score 80).
3. Contrast with **QT-1002**: 14.31% overall would pass an order-level cap, but
   four per-category line breaches route it to a Sales Manager and *not* Finance
   (worst line sits exactly at the 500 bps finance threshold). This is the
   per-line-vs-order-level story.

### 1b. Approve the chain

1. Go to **Approvals** → open QT-1001's request.
2. As the Sales Manager, press **Approve**. The request advances to the Finance
   step.
3. (To finish the chain, sign in as `finance@dealflow.test` and approve the
   Finance step. The quote becomes APPROVED.)

### 1c. Confirm → order

On the quotation detail, once approved, press **Confirm** to convert it to an
order.

### 1d. Fulfilment — ship an order (this is what unlocks "Generate invoice")

1. Go to **Fulfillment**. Seeded order **ORD-2001** (24 × RackServer R220) is
   `PACKED`.
2. Open it (the allocation screen) and use **Move to Shipped** — or the
   toolbar's **Initiate Transit** — to advance it to SHIPPED. The allocation
   plan shows the 22 + 2 split across Main and East depots.

### 1e. Invoices — Generate customer invoice (now live)

1. Go to **Invoices**. Because ORD-2001 is now shipped-but-unbilled, the
   **Generate invoice** button targets it.

   > Before you ship anything, this button reads *"Every shipped order is
   > already invoiced. Ship an order on the Fulfillment screen to enable this."*
   > — that is the honest empty state, not a broken button. Step 1d gives it
   > something to do.
2. Press it. ORD-2001 is invoiced. Open the new invoice and **Record Payment**
   to settle it.

### 1f. Subscriptions — billing document

1. Go to **Subscriptions** → open the subscription behind ORD-2002 (the mixed
   hardware/services/subscription order).
2. **Pause** / **Resume** the plan to show status transitions.
3. Press **Download Billing PDF**. This generates a printable billing summary
   (customer, cadence, amount, schedule rows) in the browser and opens the print
   dialog. It is an honestly-labelled generated document, not a server-rendered
   PDF — there is no PDF service in this build.

### 1g. Deal health — sweep, nudge, and governance

1. Go to **Deal Health**. Press **Run Sweep**: it re-scans quotations and
   reports open exceptions (QT-1004 stalled/critical, QT-1005 stalled/warning,
   QT-1006 discount-anomaly + margin-erosion).
2. On any row, use **Nudge** to ping the deal owner.
3. Press **Global Governance Rules**. A panel opens listing every per-tier and
   per-category discount ceiling straight from `/discount-policies`. As a
   manager this is **read-only**.

### 1h. Governance edit (ADMIN) — change routing by changing a ceiling

1. Sign out, sign back in as `admin@dealflow.test`.
2. Open **Deal Health → Global Governance Rules** (or **Admin → Reports → Edit
   Tier Matrix**). As an ADMIN the ceilings are **editable**.
3. Lower a ceiling (say GOLD subscriptions) and **Save**. It PATCHes
   `/discount-policies/:id`; the audit log records the change.
4. Re-evaluate an affected quote to show the routing shift the new ceiling
   causes.

---

## 2. Customer side — `buyer@meridian.test`

Sign out. Sign in as `buyer@meridian.test` / `dealflow123`.

### 2a. Isolation — the portal is all a customer can reach

- You land directly on the **customer portal** for Meridian's own quotation
  (e.g. `/portal/quotations/QT-1001/`), never the internal dashboard.
- The internal staff taskbar is **not** present — the portal has its own "Acme
  Portal" header with a customer sign-out.
- Try typing `/dashboard/` or `/quotations/` in the address bar. You are
  redirected back to the portal with *"This workspace is for internal staff."*
- The API enforces the same wall: a customer token is scoped to its own
  customer's quotes and is rejected on `/customers`, `/deal-health`,
  `/discount-policies`, `/orders`, `/approvals`, etc. (403). Confirm in devtools
  or curl:

  ```bash
  # log in, then call an internal-only endpoint with the customer token
  curl -s http://localhost:3001/api/v1/deal-health \
    -H "authorization: Bearer <customer access token>"
  # => { "success": false, "error": { "code": "FORBIDDEN", ... } }
  ```

### 2b. Review the quotation

The portal shows the quote's line items, totals and validity — all live from the
same record the internal side sees.

### 2c. Send a note to the deal desk (persists)

1. In the composer, type a note (e.g. "Can we confirm a 15% warranty discount?")
   and press **Send Note to Deal Desk**.
2. It POSTs a real `NegotiationMessage`. The message appears in the thread.
3. **Reload the page.** The note is still there — it was written to the server,
   not just to the DOM.

### 2d. Accept & sign (persists, honest semantics)

1. Press **Accept & Sign Quotation**, then **Affix Signature & Finalize** in the
   modal.
2. This POSTs `/quotes/:id/accept`: it records a `CUSTOMER_ACCEPTED` audit event
   and a thread message, and marks the quote accepted in the UI. It does **not**
   force an internal status jump — settlement stays with internal roles, so
   acceptance is logged and visible rather than silently overriding the approval
   chain.

### 2e. Download the quote document

Press **Download PDF**. As on the internal side, this builds a printable
document in the browser (quote code, line items, totals) — an honestly-labelled
generated document.

---

## What each named fix demonstrates

- **Download Billing PDF** (1f) and **Download PDF** (2e): generate a real
  printable document client-side; no more dead button.
- **Generate customer invoice** (1e): works as soon as an order is shipped; the
  seeded state starts fully invoiced, which is why shipping ORD-2001 first is
  the step that gives it something to do.
- **Global Governance Rules** (1g/1h): opens the live discount-policy table,
  read-only for most roles and editable for ADMIN.
- **Portal isolation** (2a): a customer session can never reach the internal
  workspace — enforced both at the API (scoping + role guards) and in the UI
  (role-based routing and a redirect guard).
