# Before / After

Purpose: **See exactly what one line of code does**.

## Run from a fresh clone

```bash
cd examples/before-after
npm install
npm run typecheck
npm run start:without
npm run start:with
```

Files:
- `without-clg.ts`
- `with-clg.ts`

Diff: the `with-clg` version wraps the server with `withCLG(...)` before `registerTool(...)`.
