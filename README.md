# @clgplatform/mcp

Tamper-evident decision and outcome receipts for Model Context Protocol tool calls, with real-time mandate enforcement via the CLG platform.

## Scope

- In scope: MCP tool call interception, decision evaluation, signed decision and outcome receipts, redaction hooks, fail-closed and fail-open modes.
- Out of scope: MCP resources, MCP prompts, transports other than standard MCP server, verification tooling, multi-workflow chaining.

![CI](https://img.shields.io/badge/ci-pending-lightgrey)
![Version](https://img.shields.io/badge/version-1.0.0--beta.1-blue)
![License](https://img.shields.io/badge/license-BUSL--1.1-orange)

## What it does

`@clgplatform/mcp` wraps MCP tool calls with CLG mandate checks and receipt creation. It gives operational auditability through signed chained receipts and explicit decision/outcome events.

## What this package does NOT do

- Does not perform local verification of receipts (verification is a future capability).
- Does not provide a replay or audit export API in v1.
- Does not guarantee AI Act compliance by itself; it provides technical controls that support an organization's compliance program.
- Does not manage mandates — mandates are defined and stored in the CLG platform.
- Does not intercept tools registered before `withCLG()` is applied; see Compatibility for the supported pattern.

## Why

- Supports governance-focused auditability for AI tool execution.
- Enforces mandate checks before MCP tool calls.
- Produces signed chained receipts for decision and outcome events.

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

server.registerTool('echo', { description: 'Echo' }, async () => ({
  content: [{ type: 'text', text: 'ok' }],
}));
```

## Configuration

| Field       | Type                 | Required | Default                       | Description                      |
| ----------- | -------------------- | -------: | ----------------------------- | -------------------------------- |
| apiKey      | string               |      Yes | -                             | CLG API key                      |
| agentId     | string               |      Yes | -                             | Agent identifier                 |
| mandateRef  | string               |      Yes | -                             | Mandate reference                |
| workflowId  | string               |       No | `<agentId>-<timestamp>`       | Workflow id                      |
| endpoint    | string               |       No | `https://api.clgplatform.com` | CLG endpoint                     |
| failureMode | `'closed' \| 'open'` |       No | `closed`                      | Behavior when CLG is unreachable |
| timeoutMs   | number               |       No | `5000`                        | CLG timeout                      |
| redact      | function             |       No | -                             | Input/output redaction hook      |
| beforeSend  | function             |       No | -                             | Envelope mutation hook           |
| onDecision  | function             |       No | -                             | Decision callback                |
| onOutcome   | function             |       No | -                             | Outcome callback                 |
| onError     | function             |       No | -                             | Error callback                   |

## Mandate setup

Create mandates in the CLG platform and reference them by `mandateRef` in wrapper config. See https://clgplatform.com.

## Failure modes

See `docs/failure-modes.md` for fail-closed vs fail-open guidance.

## Redaction

Use `redactPaths` to mask sensitive fields before payloads leave process memory. See `docs/redaction.md`.

## Error handling

```ts
import { CLGDeniedError, CLGUnreachableError, CLGToolExecutionError } from '@clgplatform/mcp';

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
