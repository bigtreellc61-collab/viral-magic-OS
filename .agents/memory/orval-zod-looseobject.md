---
name: Orval 8.x zod.looseObject Zod v3 incompatibility
description: Orval 8.x generates zod.looseObject() for bare "type: object" schemas, but Zod v3 has no looseObject. Must patch after every orval run.
---

## The Problem

Orval 8.21+ generates `zod.looseObject({})` for OpenAPI schemas with `type: object` and no explicit properties. Zod v3 does not have `looseObject` — this crashes the API server at startup with `TypeError: (void 0) is not a function`.

## Trigger

Running `pnpm orval --config orval.config.ts` in `lib/api-spec/` regenerates `lib/api-zod/src/generated/api.ts`. If any schema uses `type: object` (bare, no properties), orval 8.21 emits `zod.looseObject({})`.

## Fix (must run after every orval codegen)

```bash
sed -i 's/zod\.looseObject(/zod.object(/g' lib/api-zod/src/generated/api.ts
```

Then rebuild:
```bash
cd lib/api-client-react && pnpm tsc --build
```

**Why:** `zod.looseObject` is a Zod v4 feature. This workspace pins Zod v3 (see `zod-v3-format-email.md`). The API server bundles `lib/api-zod` for request validation and crashes if the file uses v4 APIs.

## Prevention

In OpenAPI specs, avoid bare `type: object` with no properties for schemas fed into the Zod code generator. Prefer:
- Named refs with explicit properties
- `additionalProperties: true` with typed values  
- No type at all (produces `z.unknown()`)

## When building new OpenAPI schemas

After any spec change that adds `type: object` items (array items, jsonb fields, dashboard response objects), run the sed patch before restarting the API server.
