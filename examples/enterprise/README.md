# Enterprise example

Purpose: **This is the demo for a platform partner**.

## Run from a fresh clone

```bash
cd examples/enterprise
npm install
export CLG_API_KEY=clg_live_xxx
npm run typecheck
npm start
```

This example demonstrates:
- three tools: `create-invoice`, `lookup-customer`, `process-payment`
- `redactPaths(...)` masking sensitive fields
- mandate-driven deny path (`process-payment` expected to be denied)
- readable console logging with `onDecision` and `onOutcome`
