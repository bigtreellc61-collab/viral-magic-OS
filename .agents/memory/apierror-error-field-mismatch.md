---
name: ApiError generated-client toast bug pattern
description: Generated api-client-react ApiError has no top-level .error field; onError handlers reading err?.error always fall back to generic text, masking real backend errors and 409/validation reasons.
---

The `ApiError` class thrown by the generated api-client-react `custom-fetch.ts` does **not** have a top-level `.error` property. The real backend error message (the JSON body's `{ error: "..." }`) lives at `err.data.error`. `err.message` is a separately formatted string, also not `err.error`.

**Why:** Frontend `onError` handlers that write `err?.error || "generic fallback"` will always take the fallback branch, since `err.error` is `undefined`. This silently swallows the real reason for every mutation failure (validation errors, 409 conflicts, etc.), showing an unhelpful generic toast instead. This exact bug caused a "Setup Failed" toast to appear on a Command Center-style app even though the underlying account creation had already succeeded — the toast was actually for a redundant/duplicate submission that correctly got a 409, but the true reason never surfaced.

**How to apply:** When reviewing or writing `useMutation`/RTK-style `onError` handlers against a generated `custom-fetch.ts`-style client, always read the error message from `err?.data?.error` (or whatever field the generated client's `ApiError.data` actually contains — check `custom-fetch.ts` directly), never from `err?.error`. Grep the whole frontend for `err?.error` / `err.error` when fixing one instance — this bug tends to be copy-pasted across every form's onError handler in the same app (login, setup, settings, etc.).
