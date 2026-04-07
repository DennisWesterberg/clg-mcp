# Basic server example

Purpose: **See the wrapper in action in 30 seconds**.

## Run from a fresh clone

```bash
cd examples/basic-server
npm install
export CLG_API_KEY=clg_live_xxx
npm run typecheck
npm start
```

This example configures one `calculator` tool. With a valid mandate and API key, tool calls go through CLG decision evaluation and receipt creation.
