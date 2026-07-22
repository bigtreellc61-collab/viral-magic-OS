---
name: Document generation library esbuild externals
description: pdfmake/docx/pptxgenjs must be externalized in build.mjs; vi.hoisted() required for mocks referenced in vi.mock() factories.
---

## Rule
Add `pdfmake`, `docx`, and `pptxgenjs` to the `external` array in `artifacts/api-server/build.mjs` whenever they are used as dependencies.

**Why:** These libraries have CJS interop complexity and/or internal file resolution that causes silent bundling failures when included in the esbuild ESM bundle. Externalizing keeps them loaded from node_modules at runtime where Node handles CJS wrapping naturally.

## Rule
When a test file uses `vi.mock("...module...", async () => { ... mockFn ... })`, any `vi.fn()` referenced inside the factory must be declared with `vi.hoisted(() => vi.fn())` — not as a plain `const`.

**Why:** `vi.mock()` factories are hoisted to the top of the file by Vitest. Any variable defined at module scope (even before the mock call in source order) is not yet initialized when the factory runs. `vi.hoisted()` runs before the hoisting step, so the variable is ready. Failure produces `ReferenceError: Cannot access '...' before initialization`.

## How to apply
- In `build.mjs` externals array, include `"pdfmake"`, `"docx"`, `"pptxgenjs"`.
- In test files: `const myMock = vi.hoisted(() => vi.fn())` then use `myMock` freely inside `vi.mock()` factories.
