---
name: Orval schema naming for entity-shaped components
description: How OpenAPI component naming interacts with Orval-generated Zod schema names, and why collisions happen.
---

When an OpenAPI spec's request/response body is defined as a `$ref` to a named component (e.g. `SetupInput`), Orval's Zod generator does NOT reuse that component name for the generated export — it names the generated schema after the operationId instead (e.g. `CompleteSetupBody`, `CompleteSetupResponse`).

**Why:** Orval's codegen collision risk is specifically when a component name happens to match the auto-derived `<OperationIdPascal>Body`/`<OperationIdPascal>Response` pattern for a *different* operation — that produces a duplicate export and a TS2308 error. Naming components entity-style (`SetupInput`, `LoginInput`, `AccountUpdate`) rather than operation-style (`CompleteSetupBody`) avoids that collision even though the generated Zod export ends up named after the operation anyway.

**How to apply:** When writing/extending an OpenAPI spec that feeds Orval codegen, name shared/reusable component schemas after the entity they represent, not after the HTTP operation. After codegen, grep the actual generated export names in `lib/api-zod/src/generated/api.ts` before writing backend code — don't assume the component name is the import name.
