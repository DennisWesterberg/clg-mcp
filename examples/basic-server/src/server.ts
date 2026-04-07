import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withCLG } from '@clgplatform/mcp';

const server = withCLG(new McpServer({ name: 'basic-server', version: '1.0.0' }), {
  apiKey: process.env.CLG_API_KEY ?? 'replace-me',
  agentId: 'basic-agent',
  mandateRef: 'mandates/basic',
});

server.registerTool(
  'calculator',
  {
    description: 'Add two numbers',
    inputSchema: { a: { type: 'number' }, b: { type: 'number' } },
  },
  async (args: { a?: number; b?: number }) => ({
    content: [{ type: 'text', text: String((args.a ?? 0) + (args.b ?? 0)) }],
  }),
);

console.log('Basic MCP server configured with CLG wrapper.');
