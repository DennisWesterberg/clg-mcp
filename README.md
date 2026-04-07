# @clgplatform/mcp

Official CLG wrapper for Model Context Protocol.

![CI](https://img.shields.io/badge/ci-pending-lightgrey)
![Version](https://img.shields.io/badge/version-1.0.0--beta.1-blue)
![License](https://img.shields.io/badge/license-BUSL--1.1-orange)

## What it does

`@clgplatform/mcp` wraps MCP tool execution with mandate evaluation and signed CLG receipts. It provides deterministic, replayable decision and outcome tracing for every guarded tool call.

## Why

- Supports AI Act aligned governance and auditability patterns.
- Enforces mandate-based accountability before tool execution.
- Produces cryptographically chained decision/outcome evidence.

## Installation

```bash
npm install @clgplatform/mcp
```

## Quick start

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withCLG } from '@clgplatform/mcp';

const server = withCLG(new McpServer({ name: 'demo', version: '1.0.0' }), {
  apiKey: process.env.CLG_API_KEY!,
  agentId: 'demo-agent',
  mandateRef: 'mandates/default',
});

server.registerTool('echo', {
  description: 'Echo input',
  inputSchema: { text: { type: 'string' } },
}, async (args) => ({
  content: [{ type: 'text', text: String(args.text ?? '') }],
}));
```

## Configuration

| Field | Type | Required | Default | Description |
|---|---|---:|---|---|
| apiKey | string | Yes | - | CLG API key |
| agentId | string | Yes | - | Agent identifier |
| mandateRef | string | Yes | - | Mandate reference |
| workflowId | string | No | `<agentId>-<timestamp>` | Workflow id |
| endpoint | string | No | `https://api.clgplatform.com` | CLG endpoint |
| failureMode | `'closed' \| 'open'` | No | `closed` | Behavior when CLG is unreachable |
| timeoutMs | number | No | `5000` | CLG timeout |
| redact | function | No | - | Input/output redaction hook |
| beforeSend | function | No | - | Envelope mutation hook |
| onDecision | function | No | - | Decision callback |
| onOutcome | function | No | - | Outcome callback |
| onError | function | No | - | Error callback |

## Mandate setup

Create mandates in CLG platform and reference them via `mandateRef` in wrapper config. See CLG docs: https://clgplatform.com

## Failure modes

See `docs/failure-modes.md` for fail-closed and fail-open guidance and recommendations.

## Redaction

Use `redactPaths` for deterministic masking before payloads leave process memory. See `docs/redaction.md`.

## Error handling

```ts
import {
  CLGDeniedError,
  CLGUnreachableError,
  CLGToolExecutionError,
} from '@clgplatform/mcp';

try {
  // guarded tool execution
} catch (error) {
  if (error instanceof CLGDeniedError) {
    // denied by mandate
  } else if (error instanceof CLGUnreachableError) {
    // CLG unavailable
  } else if (error instanceof CLGToolExecutionError) {
    // tool failed after approval
  }
}
```

## Compatibility

See `docs/compatibility.md`.

## Examples

- `examples/basic-server`
- `examples/before-after`
- `examples/enterprise`

## License

BUSL-1.1. Production use requires commercial license. Contact dennis@aistrateg.se.

## Status

Beta. Production use requires commercial license.
