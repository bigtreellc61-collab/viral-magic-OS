---
name: Zod v3 pinned in this workspace — no top-level z.email()
description: Adding format: email to an OpenAPI string schema breaks Orval's generated Zod file under Zod v3.
---

This workspace's `zod` catalog version resolves to Zod v3, not v4. Zod v4 introduced top-level helpers like `z.email()`; Zod v3 does not have them.

**Why:** Orval's Zod generator translates an OpenAPI `type: string, format: email` property into a `zod.email()` call in the generated file. Under Zod v3 that function doesn't exist, so the generated `lib/api-zod/src/generated/api.ts` fails to typecheck with `Property 'email' does not exist on type ...` — even though the OpenAPI spec itself and the `orval` codegen step both "succeed" (the failure only shows up in the subsequent `tsc --build` typecheck).

**How to apply:** Don't add `format: email` (or other Zod-v4-only format helpers) to OpenAPI string schemas that feed this workspace's Orval codegen. Use a plain `type: string` and validate email format elsewhere (e.g. a regex `pattern`, or leave it unvalidated at the schema level) until/unless the workspace's zod catalog entry is upgraded to v4.
