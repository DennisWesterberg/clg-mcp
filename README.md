# @clgplatform/mcp

CLG adds mandate enforcement and signed receipts around MCP tool execution.

![npm](https://img.shields.io/npm/v/@clgplatform/mcp) ![node](https://img.shields.io/node/v/@clgplatform/mcp) ![license](https://img.shields.io/badge/license-BUSL--1.1-orange)

## What it is

`@clgplatform/mcp` wraps MCP tool calls with a CLG decision gate.
For each tool execution attempt, it sends a decision request to CLG, blocks denied calls, allows approved calls, and emits signed receipts.

## What you get

- mandate enforcement before tool execution
- signed decision receipts
- signed outcome receipts
- explicit deny path
- redaction hooks
- callbacks for decision/outcome/error
- fail-closed and fail-open behavior when CLG is unavailable

## What it does not do

- does not verify receipts locally (use `@clgplatform/verify`)
- does not manage mandates itself (mandates are defined in CLG)
- does not cover MCP resources or prompts
- does not by itself guarantee legal or regulatory compliance
- does not replace broader governance controls

## How it works

1. Tool call is intercepted by the wrapper.
2. Decision request is sent to CLG.
3. CLG returns approved or denied.
4. Tool executes only if approved.
5. Outcome receipt is created after execution.
6. Receipts can later be verified with `@clgplatform/verify`.

## Installation

```bash
npm install @clgplatform/mcp
```

## Prerequisites

- CLG API key
- registered CLG agent
- mandate reference (`mandateRef`)
- MCP server using the official MCP SDK (`@modelcontextprotocol/sdk`)

## Quick start

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withCLG } from '@clgplatform/mcp';

const server = withCLG(new McpServer({ name: 'demo', version: '1.0.0' }), {
  apiKey: process.env.CLG_API_KEY!,
  agentId: 'demo-agent',
  mandateRef: 'default',
});

server.registerTool('echo', { description: 'Echo' }, async (args) => ({
  content: [{ type: 'text', text: JSON.stringify(args) }],
}));
```

## Approve and deny path

- **Approve:** tool handler runs, then an outcome receipt is emitted.
- **Deny:** tool handler is not run; a denied decision is surfaced (`CLGDeniedError`).

## Configuration

| Field | Type | Required | Default | Description |
|---|---|---:|---|---|
| `apiKey` | `string` | Yes | — | CLG API key |
| `agentId` | `string` | Yes | — | Registered agent id |
| `mandateRef` | `string` | Yes | — | Mandate reference used for decisioning |
| `workflowId` | `string` | No | `<agentId>-<timestamp>` | Workflow id for receipt chaining |
| `endpoint` | `string` | No | `https://api.clgplatform.com` | CLG API base URL |
| `failureMode` | `'closed' \| 'open'` | No | `closed` | Behavior when CLG is unreachable |
| `timeoutMs` | `number` | No | `5000` | Decision request timeout |
| `redact` | `(input) => input` | No | — | Redact payloads before sending to CLG |
| `beforeSend` | `(envelope) => envelope` | No | — | Final mutation hook for decision envelope |
| `onDecision` | `(result) => void` | No | — | Callback after CLG decision response |
| `onOutcome` | `(receipt) => void` | No | — | Callback when outcome receipt is emitted |
| `onError` | `(error) => void` | No | — | Callback for CLG wrapper errors |

## Redaction and hooks

- `redact` for payload-level redaction
- `beforeSend` for final decision-envelope mutation
- `onDecision` for decision telemetry
- `onOutcome` for outcome telemetry
- `onError` for wrapper error handling

## Failure modes

See [`docs/failure-modes.md`](./docs/failure-modes.md).

## Verify the receipts

After execution, verify signed receipts with `@clgplatform/verify`:

```bash
npm install @clgplatform/verify
clg-verify --public-key signing-key.pem receipt receipt.json
```

## Examples

- [`examples/basic-server`](./examples/basic-server)
- [`examples/before-after`](./examples/before-after)
- [`examples/enterprise`](./examples/enterprise)

## Documentation

- [`docs/failure-modes.md`](./docs/failure-modes.md)
- [`docs/redaction.md`](./docs/redaction.md)
- [`docs/compatibility.md`](./docs/compatibility.md)

## Status

Beta.

## License

BUSL-1.1. See [`LICENSE`](./LICENSE).
