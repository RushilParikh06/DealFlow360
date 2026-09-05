# DealFlow360 UI audit — 6 September 2026

The UI fixes below are implemented and covered by regression checks. **The application is not ready for production sign-off:** several screens still lack live feature integrations, the local API was unreachable during browser verification, and the API lint command has no installed ESLint configuration/toolchain. Those limits are recorded explicitly rather than treated as passing checks.

## Scope and baseline

Inspected the complete repository inventory and the active UI path: `apps/web/app` → route resolution → `legacy-pages.ts` → all 15 `pages/*.html` templates and their embedded scripts → `page-client.tsx` → shared DOM helpers and API bindings. Reviewed the shared theme, Tailwind configuration, both asset trees, legacy standalone scripts/styles, route configuration, existing tests, relevant API controllers/response shapes, contracts, and persistence models. Backend business rules were not rewritten.

Baseline findings:

- Production export and TypeScript compilation passed.
- All 23 API suites / 121 tests passed, with an existing ts-jest deprecation warning.
- Both frontend checks failed: the live-row CSS marker disagreed with the DOM helper, and the table test expected a different marker.
- At 390px, invoice actions overflowed to 411px and the portal header to 562px.
- Live records could inherit sample links, colors, icons, counts and field positions.
- Several simulated buttons reported successful payments, approval routing, exports or signatures without saving anything.
- The environment's pnpm launcher attempted dependency reconciliation and stopped on its existing Nest build-script policy. Verification used the installed package executables/npm scripts; no build-script permissions were granted and no dependencies were added.

## UI standard

Preserve the existing cream surfaces, cobalt primary actions, dark outlines, IBM Plex Sans body type and Courier Prime metrics. Body text follows the existing 14px/20px scale; headings scale from 24px on narrow screens to 28px on desktop. Retain the existing 4/8/12/16/24/32/48px spacing tokens and deliberate page-specific card treatment.

Shared controls have a 40px minimum height, increasing to 44px on mobile. Mobile text inputs use 16px text. Checkboxes retain native sizing instead of being stretched into 44px controls. Keyboard focus uses a visible 3px outline. Tables scroll locally, retain visible scrollbars and expose a keyboard-focusable region. Feedback belongs in the content area or the open dialog. Preview data and unconnected actions must be identified explicitly.

The application currently supports a light theme only. No dark theme was invented during this audit.

## Issue ledger

| ID | Severity / category | Location and root cause | Resolution and verification |
|---|---|---|---|
| UI-001 | High / functional | CSS checked `data-df-live`; helpers wrote `data-live`, hiding rows after the third | Unified the marker, removed the row cap, concealed only unhydrated templates. Six-record DOM regression passes. |
| UI-002 | High / functional | Table writer replaced icon text and retained stale secondary values | Text-node updates preserve markup and support stacked values. Existing DOM regressions pass. |
| UI-003 | High / functional | Approval columns ignored the leading selection column | Corrected all mapped indexes; six-record API fixture verifies customer, risk and approval-stage placement. |
| UI-004 | High / responsive | Invoice actions were a non-wrapping flex row | Enabled wrapping; viewport sweep verifies the result. |
| UI-005 | High / responsive | Portal header assumed a desktop-width horizontal layout | Header and navigation wrap; mobile header stacks. Viewport sweep verifies the result. |
| UI-006 | High / accessibility | Sign-in/error banners were prepended behind the fixed header | Feedback now sits inside main content, with status/alert semantics and replacement of old feedback. Browser and DOM checks pass. |
| UI-007 | Medium / functional | Signup route initialized the sign-in mode | `/signup/` selects signup and uses new-password autocomplete. Browser verification passes. |
| UI-008 | Medium / accessibility | Login error text replaced the button label and was truncated | Separate persistent error region; submit label and enabled state recover after failure. Local connection-error state verified. |
| UI-009 | Medium / functional | Requests could leave the UI waiting indefinitely | Native 15-second request timeout; error handling restores the form. No new networking dependency. |
| UI-010 | Medium / consistency | Global surface-bright token differed from the cream design | Corrected the shared token. Production screenshots checked. |
| UI-011 | Medium / consistency | Tailwind did not scan classes created in `lib/*.ts`; dashboard primary token was absent | Added the library source path and reused the primary token for cobalt-active. Production build passes. |
| UI-012 | Medium / accessibility | Global scrollbar hiding concealed scrollable content | Restored native scrollbars, local table scroll regions and keyboard access. Mobile/table screenshots checked. |
| UI-013 | Medium / accessibility | Mobile minimum heights enlarged checkboxes; form controls and icon targets varied | Scoped shared dimensions to the relevant controls, preserved native checkboxes, added mobile text sizing and header target sizing. |
| UI-014 | Medium / accessibility | Unnamed icon buttons, inputs and selects across templates | Added source-level accessible names/label associations. Regression scans all 15 templates. |
| UI-015 | Medium / accessibility | Decorative ligatures polluted accessible names; no skip link or table column scope | Hide decorative symbols from assistive technology, add skip-to-content, and identify table headers. DOM/browser checks pass. |
| UI-016 | Medium / accessibility | Navigation lacked controls association, Escape closure and an updated toggle name | Added menu association, open/close label, Escape focus return and outside-click closure. Browser verified. |
| UI-017 | High / accessibility | Dialogs lacked focus management, background isolation and Escape dismissal | Shared dialog behavior traps keyboard focus, makes background siblings inert, returns focus, and restores scrolling. Strict-mode cleanup regression and browser modal checks pass. |
| UI-018 | Medium / responsive | Dialog content could be taller than the available screen | Bounded dialog/inner-panel height with scrolling. Mobile signature dialog checked. |
| UI-019 | High / functional | Prototype actions claimed persistence, including payment and signature success | Explicit unavailability metadata and a capture-phase guard prevent these actions and form submissions from reaching simulation handlers. Feedback appears inside an open dialog when applicable. Regression verifies no simulated mutation. Real feature wiring remains blocked as described below. |
| UI-020 | High / functional | Live row clones inherited the sample record's detail link/actions | Remove inherited detail URLs and identify unconnected actions; allow explicit future per-record handlers. Regression verifies sample URLs do not survive. |
| UI-021 | Medium / consistency | Live rows inherited warning/highlight styling from the template | Reset sample row highlighting and neutralize template-only chip tones/glyphs when displaying new values. Backend status text remains visible. |
| UI-022 | Medium / functional | Pagination and counts remained hard-coded after data changed | Counts now reflect state; quotation/approval pagination uses returned page, page size and total. Three-page and last-page regressions pass. |
| UI-023 | Medium / functional | Search boxes had no live-record behavior | Quotation, approval and deal-health searches filter the loaded page, explicitly labelled as such. No-match and recovery checks pass. Unconnected selectors are disabled rather than pretending to filter. |
| UI-024 | Medium / responsive | Empty text was centered beyond the visible portion of a wide table | Left-align empty/loading/error text so it is immediately visible without horizontal scrolling. Mobile screenshots checked. |
| UI-025 | Medium / functional | Dashboard labels had drifted from route regexes; icon text broke the invoice breadcrumb match | Match readable labels, update route aliases and assign actual anchor hrefs. Dashboard navigation and invoice breadcrumb inspected. |
| UI-026 | Medium / functional | Portal anchors referenced nonexistent targets | Point quotation, messages and profile navigation at real page targets. |
| UI-027 | Low / accessibility | Toggle state and password visibility were not announced | Add pressed state to authentication/report controls, password visibility labels and autocomplete updates. Signup/password behavior verified. |
| UI-028 | Medium / accessibility | Warehouse override opened out of view without focus/state feedback | Associate trigger/panel, update expanded state, scroll and focus on open, return focus on close. |
| UI-029 | Low / consistency | Invalid `py-0.2` and `opacity-85` utility classes had no generated styling | Replaced with existing supported spacing/opacity utilities. Build passes. |
| UI-030 | Medium / accessibility | Removing important declarations exposed an active-nav specificity conflict | Corrected selector scope; browser computed styles verify white text on cobalt for desktop and mobile active links. |
| UI-031 | Medium / responsive | A 320px screen squeezed the header's notification/avatar group | Standardized mobile gaps and retained actionable targets; hide decorative profile preview and brand subtitle on mobile. Narrow-screen sweep repeated. |
| UI-032 | Low / UX | Login offered a “remember workspace” checkbox with no behavior and only one fixed workspace | Removed the unused control. No authentication/storage behavior changed. |
| UI-033 | Medium / accessibility | Select-all checkbox did not control hydrated row checkboxes and retained stale state after pagination | Preserve row selection inputs, add labels and delegated selection/indeterminate behavior, reset selection on new records. Regression checks select-all, partial selection and pagination reset. |

## Remaining production blockers and deliberately unchanged areas

| Area | Technical reason / required follow-up |
|---|---|
| Ten preview screens | Dashboard, quotation detail, approval detail, warehouse allocation, subscriptions, subscription billing, invoices, invoice detail, customer portal and reports have no page binder in `live.ts`. Implement record-aware loaders and authorized workflow handlers before enabling their final actions. Displaying a template or a success toast does not satisfy this integration. |
| Record details | Static export prebuilds only the example detail IDs. Loading arbitrary API records requires an agreed routing strategy plus detail loaders. Redirecting every record to Q-1042 is incorrect and is now prevented. |
| Advanced filters, notifications, account/profile display, reporting/admin tools | Several controls and summary metrics are still template content, without matching UI handlers or full response data. Native unconnected selectors and known simulated actions are guarded; preview notices identify these screens. Preview-screen pagination still has sample page numbers without loaders. These are not certified as working features. |
| Fulfillment inventory | The existing binding loads only the orders table. Inventory, routing, priority and allocation fields need their own endpoint adapters. Missing fields remain placeholders rather than browser-generated business decisions. |
| Live end-to-end verification | The local login endpoint at `localhost:3001` was unreachable and the workspace has no `.env`. Login error recovery was checked in a browser; populated list mapping, pagination and filtering were checked with deterministic API fixtures. Real login, database-backed writes, permissions and destructive actions have not passed end-to-end verification. |
| API lint | The declared command invokes ESLint, but ESLint/configuration is absent. Web “lint” is explicitly TypeScript checking. A lint pass is not claimed for the API. |
| Existing test/environment warnings | ts-jest reports its existing deprecated isolatedModules configuration; npm prints an update notice. The pnpm launcher has an existing dependency build-policy problem. These were not hidden or resolved by weakening policy. |
| Legacy standalone preview | `index.html`, `assets/js/app.js` and `assets/css/app.css` are the original standalone preview, not the Next production runtime. The Next loader uses the HTML bodies and inline scripts, excludes external script tags, and uses the shared Next stylesheet. Standalone preview auth/action simulation is not a supported production entry point and was not certified. Retiring or migrating that alternative entry point requires an explicit product/deployment decision. |
| Dark theme / external font delivery | The app declares a light color scheme and has no dark-theme UI. Google-hosted fonts loaded during browser checks; offline/font-service outage behavior is not a completed cross-browser/font-fallback certification. |

## Verification and evidence

- Production export: `npm --prefix apps/web run build` — passed. See [build log](final-build.log).
- Frontend regression suite: `npm run test:smoke` — passed. Covers source labels, table integrity, API column mapping, pagination/search and shared keyboard behavior. See [frontend log](final-ui-tests.log).
- API suite: installed Jest runner, 23 suites / 121 tests — passed. See [API log](final-api-tests.log).
- TypeScript: web, API and contracts — passed. Web lint script — passed (it runs TypeScript).
- Browser checks use the compiled static export on `127.0.0.1:3100`, with hydration awaited on each route. The final repeat covered all 16 routable variants of the 15 screens, including `/signup/`, at 320×740, 390×844, 768×1024, 1366×900 and 1920×1080: **80/80** had no page-level horizontal overflow, no clipped header buttons/images, and exactly one primary heading. No browser warnings or errors were logged in this run.
- Additional review after the final matrix confirmed warehouse override focus/expanded-state restoration, report tab pressed-state changes without mobile overflow, and the bounded mobile signature dialog. This review is separate from the earlier baseline and first correction pass; it does not certify the unavailable live workflows.
- Screenshots were captured in the audit conversation for baseline mobile login/approvals, portal and invoice overflow comparisons, desktop dashboard, mobile navigation, and the signature dialog. Browser logs are checked separately from development hot-refresh history.

Production readiness remains **blocked**, even when the corrected visual/layout checks pass. The unresolved feature and environment gates above require follow-up; they are not silently waived.
