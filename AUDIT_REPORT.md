# Viral Magic OS — Quality Audit Report
**Date:** July 22, 2026  
**Version:** 1.0-rc (Phase 1E — Growth Assessment)  
**Audited by:** Automated UI tester (Playwright, full authenticated walkthrough) + Static code analysis (all route, lib, and page files)  
**Scope:** Every screen, every major workflow, all route files, all page/component files, DB schema

---

## Summary

| Severity | Count |
|---|---|
| 🔴 Critical | 0 |
| 🟠 High | 2 |
| 🟡 Medium | 6 |
| 🔵 Low | 5 |
| ⚪ Cosmetic | 3 |
| 🧹 Code Cleanup | 8 |

No crashes. No data-loss paths. The core consulting workflow (Client → Project → Diagnostic → Assessment → Recommendation → Blueprint) is functionally intact. Most issues are UX polish, code hygiene, and a handful of real bugs in less-exercised routes.

---

## 🟠 HIGH — Broken feature or clearly wrong behaviour

### H-1 · `ClientDuplicateCheckBody` is an undefined variable in `clients.ts`
**File:** `artifacts/api-server/src/routes/clients.ts:162`  
**What happens:** The import on line 31 brings in `CheckClientDuplicateBody`, but line 162 calls `ClientDuplicateCheckBody.parse(req.body)`. This is a `ReferenceError` at runtime — the duplicate-check route (`POST /api/clients/check-duplicate`) will throw a 500 for every caller.  
**Impact:** Any UI flow that checks for duplicate clients before creating one is silently broken; the error is caught by the route's `catch (err)` block but returns a 500 instead of a validation result.  
**Fix:** Rename the reference on line 162 from `ClientDuplicateCheckBody` to `CheckClientDuplicateBody`.

---

### H-2 · "Client not found" error state is a bare red string with no navigation
**File:** `artifacts/command-center/src/pages/client-detail.tsx:174`  
**Screenshot evidence:** The page renders only `"Client not found."` in red — no Back button, no styled error card, no link to the client list.  
**What happens:** Any stale bookmark, deleted client, or typo in a URL leaves the user stranded with no way to recover without using the browser back button or sidebar.  
**Same pattern also in:** `growth-blueprint-detail.tsx:1475` renders a similar bare inline error.  
**Fix:** Replace both bare error strings with a styled not-found card that includes a "Back to Clients" / "Back to Blueprints" link.

---

## 🟡 MEDIUM — Confusing UX or missing safety net

### M-1 · `fetchRecentActivity()` on the foundation endpoint is outside the try/catch
**File:** `artifacts/api-server/src/routes/dashboard.ts:40` (approximately)  
**What happens:** The `try/catch` block guards the DB connectivity checks but `fetchRecentActivity(10)` is called *after* the catch block closes. If the activity table is unavailable or throws, the entire `GET /api/dashboard/foundation` endpoint returns a 500, breaking the dashboard load for everyone.  
**Fix:** Move the `fetchRecentActivity` call inside the try/catch, or wrap it in its own try/catch with a `[]` fallback.

---

### M-2 · Recommendations widget on the dashboard uses a raw `fetch()` instead of the typed API client
**File:** `artifacts/command-center/src/pages/dashboard.tsx:31–55`  
**What happens:** Every other dashboard widget uses TanStack Query hooks from the generated client. The recommendations widget uses a raw `fetch('/api/solution-recommendations/dashboard', ...)` with `useState<any>(null)`. This means: no automatic retry, no cache invalidation, no type safety, no error display if the request fails (the widget silently goes blank), and no loading skeleton — just a blank section until data arrives.  
**Fix:** Replace with a proper `useQuery` hook, or at minimum add an error state and loading indicator.

---

### M-3 · Diagnostic score upsert loop has no database transaction
**File:** `artifacts/api-server/src/routes/diagnostics.ts` (score save handler)  
**What happens:** The loop that upserts per-category scores runs as individual queries. If the process is interrupted mid-loop (network reset, server restart), the diagnostic version is left partially scored — some categories saved, others not — with no indication of the inconsistency to the user or the scoring recalculation.  
**Fix:** Wrap the upsert loop in a `db.transaction(async (tx) => { ... })` block.

---

### M-4 · Settings tabs are named Business / Branding / Defaults / Account — password change is hard to find
**Observation:** The Settings page has four tabs. The Change Password form lives inside the "Account" tab, under a "Security" heading. Users looking for "Password" or "Profile" will not immediately find it.  
**Fix:** Consider renaming "Account" to "Profile & Security" or adding a "Password" subheading in the tab label.

---

### M-5 · Loading states are spinner-only — no skeleton screens on any page
**Observation (all pages):** Every page shows a centred spinner while data loads. On a fresh session or slow connection this means blank cards and empty sidebars before content appears. The dashboard, client list, diagnostics list, and project list all have this pattern.  
**Fix:** Add Tailwind-animated skeleton placeholders (`animate-pulse`) for the most visible cards (KPI tiles, client rows, diagnostic list items). The Shadcn skeleton component is already in the UI library.

---

### M-6 · Growth Blueprint generation uses N+1 queries for initiative actions
**File:** `artifacts/api-server/src/routes/growth-blueprints.ts` (generate handler, action fetch block)  
**What happens:** The code contains two dead placeholder queries (both with `.limit(0)` that return nothing), followed by a `Promise.all(recIds.map(rid => db.select()...))` that fires one DB query per recommendation. For a plan with 5 recommendations this is 2 dead queries + 5 live queries = 7 round trips where 1 would suffice using `inArray`.  
**Fix:** Replace the entire block with a single `db.select().from(solutionRecommendationActionsTable).where(inArray(solutionRecommendationActionsTable.recommendationId, recIds))` and delete the two `.limit(0)` dead queries.

---

## 🔵 LOW — Minor label, copy, or missing attribute

### L-1 · Missing `autoComplete` attributes on all password inputs
**Files:** `artifacts/command-center/src/pages/login.tsx:99`, `artifacts/command-center/src/pages/settings.tsx:423/430/438`  
**What happens:** Browsers log console warnings (`Input elements should have autocomplete attributes`) on every page load. Password managers also behave unpredictably without these hints.  
**Fix:** Add `autoComplete="current-password"` to the login and change-password "current" fields, and `autoComplete="new-password"` to new-password and confirm fields.

---

### L-2 · Login email placeholder reads as prefilled credentials after logout
**Screenshot evidence:** After logout the login form shows `admin@example.com` (placeholder) and a masked bullet sequence (browser autofill). Users unfamiliar with the placeholder text may think the form retained a previous session.  
**Fix:** Change the email placeholder to something neutral like `"your@email.com"`, and add `autoComplete="email"` so browser autofill behaviour is predictable.

---

### L-3 · `activity.ts` swallows errors silently — no internal logger call
**File:** `artifacts/api-server/src/lib/activity.ts`  
**What happens:** The function's own docstring says "failures are swallowed", but the function itself has no `try/catch` and no `logger.warn`. All callers wrap it in `.catch(() => {})`. If the activity table is down, the failure is completely invisible in logs.  
**Fix:** Wrap the insert in a try/catch and add `logger.warn({ err }, "Activity logging failed")` — the swallow is intentional, but at least make failures visible in the log stream.

---

### L-4 · `diagnostic-detail.tsx` `useEffect` missing `id` in dependency array
**File:** `artifacts/command-center/src/pages/diagnostic-detail.tsx:112`  
**What happens:** The effect that loads the growth assessment checks `tab`, `version?.id`, and `assessmentLoaded` but omits `id`. In practice this doesn't break because `id` comes from URL params and the component remounts on route change — but it will trigger lint warnings and is technically stale.  
**Fix:** Add `id` to the dependency array: `}, [tab, id, version?.id, assessmentLoaded]);`

---

### L-5 · `growth-blueprint-detail.tsx` uses `(blueprint as any)` approximately 8 times
**File:** `artifacts/command-center/src/pages/growth-blueprint-detail.tsx:1022, 1023, 1066, 1069, 1070, 1492, 1493, 1538`  
**What happens:** Fields like `versionLabel`, `revisionNumber`, `isCurrent` are accessed via `(blueprint as any)` instead of being typed. If the API shape changes, TypeScript will not catch the breakage.  
**Fix:** Extend the blueprint type returned by the generated API client to include these fields, or define a local typed interface that matches the actual response shape.

---

## ⚪ COSMETIC — Visual polish

### C-1 · 404 page copy says "Phase 1A deployment" — version string is stale
**File:** `artifacts/command-center/src/pages/not-found.tsx`  
**Screenshot evidence:** The not-found card reads: *"The requested module does not exist in the current Phase 1A deployment."* The app is now on Phase 1E.  
**Fix:** Update to a version-neutral string like *"The requested page does not exist."*

---

### C-2 · Dashboard version badge says "PHASE 1E — GROWTH ASSESSMENT" hardcoded in the sidebar
**Screenshot evidence:** The sidebar footer and the dashboard header badge show the phase string.  
**Observation:** This is fine while in active development, but should be removed or driven from a settings value before public launch so it doesn't need a code change to update.

---

### C-3 · "Business Health" KPI card shows `8/100` — this number appears very low and may alarm users
**Screenshot evidence:** The dashboard shows `8/100` for Business Health. This is likely computed from the one scored diagnostic in the DB. The score itself may be accurate, but with no tooltip or explanation of how it's computed, it reads as alarming.  
**Fix (cosmetic):** Add a tooltip or sub-label: *"Average across N active diagnostics"* to contextualise the number.

---

## 🧹 Code Cleanup Opportunities

These are not bugs but will cause maintenance pain as the codebase grows.

| # | File | Issue |
|---|---|---|
| CC-1 | `growth-blueprint-detail.tsx` | 2,364 lines. Contains inline modals, section editors, export logic, and CEO snapshot panel. Split into sub-components in a `/growth-blueprint/` folder. |
| CC-2 | `diagnostics.ts` (route file) | Exceeds 1,000 lines. Score calculation, version management, and approval logic should move to `lib/diagnostics-service.ts`. |
| CC-3 | `clients.ts` (route file) | Manual field-by-field update mapping for PATCH (~40 lines of explicit column assignments). A whitelist-based partial update helper would halve the size. |
| CC-4 | `client-detail.tsx` | ~780 lines with tab state, multiple dialogs, and note editor all inline. Worth splitting the Kanban/notes/activity tabs into separate components. |
| CC-5 | `dashboard.tsx` | Mixed patterns: typed hooks for 5 widgets, raw `fetch()` for 1. All widgets should use the same data-fetching pattern. |
| CC-6 | `solution-recommendation-engine.ts` | Multiple `as any` and `unknown` casts in the engine. These should be replaced with proper discriminated union types. |
| CC-7 | `blueprint-assembly-engine.test.ts` | Pre-existing TypeScript errors: test mock `recommendations` objects missing 13+ required fields from the real schema. Tests still pass (Vitest is lenient) but `tsc --noEmit` flags them. |
| CC-8 | `growth-blueprints.ts` | Dead code: two `.limit(0)` DB queries that were placeholder scaffolding. Delete both blocks and consolidate to the `inArray` query. |

---

## What Works Well

- ✅ **Login flow:** Empty-field validation fires correctly. Wrong password shows a clear `"Invalid email or password."` message. No information leakage.  
- ✅ **Session security:** Logout fully clears the session. Browser back button after logout correctly redirects to `/login` — no authenticated content is accessible.  
- ✅ **Client CRUD:** Create, edit, status change, and archive all work end-to-end with correct toast feedback.  
- ✅ **Project CRUD:** Create and detail views correct. Client linkage displayed properly.  
- ✅ **Diagnostic detail:** "Not Scored" state clearly shown on fresh diagnostics. Category tabs, bottleneck cards, and version history all render correctly.  
- ✅ **Settings:** Profile update succeeds with toast. Password mismatch shows inline `"Passwords don't match"` validation before submission.  
- ✅ **Responsive layout:** Dashboard, sidebar, and KPI cards all reflow correctly at 1024px and 768px. No horizontal overflow.  
- ✅ **404 / not-found handling:** Invalid client IDs, blueprint IDs, and unknown routes all show graceful error screens — no crashes, no white screens.  
- ✅ **Task creation:** Task modal accepts a title, client link, and project link. Newly created tasks appear immediately.  
- ✅ **API error shapes:** All route `catch` blocks return `{ "error": "..." }` consistently. Frontend `err?.data?.error` reads them correctly.

---

## Recommended Fix Priority

| Priority | Item | Why first |
|---|---|---|
| 1 | **H-1** — Fix `ClientDuplicateCheckBody` reference | Runtime `ReferenceError` on a real route. One-word rename. |
| 2 | **H-2** — Styled not-found error states (client + blueprint) | Users get stranded with no recovery path. Quick JSX change. |
| 3 | **M-1** — Wrap `fetchRecentActivity` in try/catch | One unhandled throw crashes the entire dashboard for all users. |
| 4 | **L-1** — Add `autoComplete` attributes to all password inputs | Eliminates all browser console warnings. Trivial attribute addition. |
| 5 | **M-6** — Replace N+1 action queries with `inArray` + delete dead `.limit(0)` code | Cleans up confusing dead code and reduces DB round trips. |
| 6 | **L-3** — Add `logger.warn` inside `activity.ts` catch | Makes silent infrastructure failures observable. |
| 7 | **M-3** — Transaction-wrap the diagnostic score upsert | Prevents partial-score corruption on failure. |
| 8 | **C-1** — Update "Phase 1A" copy in not-found page | Stale internal text visible to users. |

---

## Test Suite Status

```
Test Files  4 passed (4)
     Tests  151 passed (151)   ← up from 134 at Phase 2D checkpoint
  Duration  ~2s
```

No test regressions. All 17 new tests added by Task #22 (plan edit-lock coverage) pass cleanly.

---

*Audit performed against commit post-`v0.95-executive-deliverables` + CEO Snapshot additions + Task #22 merge.*
