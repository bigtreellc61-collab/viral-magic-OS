---
name: connect-pg-simple + esbuild bundling
description: connect-pg-simple's createTableIfMissing reads a sibling table.sql at runtime; bundling it breaks that.
---

`connect-pg-simple`'s `createTableIfMissing: true` option reads a `table.sql` file that ships alongside its own module file, using a path relative to its own location at runtime (not a bundler-friendly `import`/`require` of an asset).

**Why:** When an esbuild (or similar) bundler inlines the package into a single output file (e.g. `dist/index.mjs`), that relative path no longer points at a real `table.sql` on disk, so the first session write fails with `ENOENT: ... open '.../dist/table.sql'`. The failure is easy to miss because login/setup requests still return 200 — only the session store write silently fails, so `req.session.userId` never persists and every subsequent authenticated request 401s.

**How to apply:** Any Express/Node backend using `connect-pg-simple` with esbuild bundling must add `"connect-pg-simple"` to the bundler's `external` list (e.g. api-server's `build.mjs`) so it's required normally from `node_modules` at runtime instead of inlined.
