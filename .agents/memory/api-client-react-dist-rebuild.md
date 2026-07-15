---
name: api-client-react dist rebuild needed
description: After running Orval codegen, the dist/ .d.ts files in lib/api-client-react must be rebuilt before TypeScript consumers can see new exports.
---

## Rule
After every Orval codegen regeneration, run `cd lib/api-client-react && pnpm tsc --build` before running typechecks in consumer packages.

**Why:** The package uses TypeScript project references with `composite: true` and emits to a `dist/` directory. Consumer packages resolve `@workspace/api-client-react` against the compiled `.d.ts` files, not the source. If you run `tsc --noEmit` in a consumer without rebuilding the lib first, TypeScript reports "no exported member" for all new hooks and types even though the source is correct.

**How to apply:** Whenever you run Orval codegen, follow with `cd lib/api-client-react && pnpm tsc --build`. Do this BEFORE running any consumer typechecks.
