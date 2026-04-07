import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { redactPaths, withCLG } from '@clgplatform/mcp';
import type { EvaluateDecisionResult, Receipt } from '@clgplatform/sdk';

const server = withCLG(new McpServer({ name: 'enterprise', version: '1.0.0' }), {
  apiKey: process.env.CLG_API_KEY ?? 'replace-me',
  agentId: 'enterprise-agent',
  mandateRef: 'mandates/upptec-demo',
  redact: redactPaths(['customer.ssn', 'payment.account.number']),
  onDecision: (result: EvaluateDecisionResult) =>
    console.log('[decision]', result.decision, result.reason ?? '-'),
  onOutcome: (receipt: Receipt) => console.log('[outcome]', receipt),
});

server.registerTool('create-invoice', { description: 'Create invoice' }, async () => ({
  content: [{ type: 'text', text: 'invoice-created' }],
}));

server.registerTool('lookup-customer', { description: 'Lookup customer' }, async () => ({
  content: [{ type: 'text', text: 'customer-found' }],
}));

server.registerTool(
  'process-payment',
  { description: 'Process payment (expected deny)' },
  async () => ({
    content: [{ type: 'text', text: 'payment-processed' }],
  }),
);

console.log('Enterprise example ready. process-payment should be denied by mandate.');
