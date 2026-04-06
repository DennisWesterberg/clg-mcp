# CLG MCP Wrapper

MCP (Model Context Protocol) wrapper for CLG Platform mandate evaluation.

## Installation

```bash
npm install clg-mcp
```

## Quick start

```ts
import { CLGMCPWrapper } from 'clg-mcp';

const mcp = new CLGMCPWrapper({
  apiUrl: 'https://api.clgplatform.com',
  apiKey: process.env.CLG_API_KEY!,
  agentId: 'agent-001',
  workflowId: 'workflow-001',
});

const result = await mcp.guard(
  { toolName: 'invoice:create', toolInput: { amount: 100 } },
  async () => ({ invoiceId: 'inv-1' })
);

console.log(result.receipt.receipt_hash);
```

## API

### `CLGMCPWrapper`

Constructor options:
- `apiUrl`: CLG Platform base URL
- `apiKey`: API key (live key)
- `agentId`: Agent identifier
- `workflowId`: Workflow/context identifier
- `timeoutMs` (optional): Request timeout in ms (default 5000)

#### `evaluateTool(context, mandateRef?)`

Evaluates a tool call against CLG mandates. Returns `{ approved: boolean, reason: string | null, receipt }`.

#### `guard(context, toolFn, mandateRef?)`

Shorthand: evaluates, then runs `toolFn` if approved. Returns `{ result, receipt }` or throws with denied reason.

## License

MIT
