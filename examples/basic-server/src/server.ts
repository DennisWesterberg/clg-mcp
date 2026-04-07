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
  },
  async () => ({
    content: [{ type: 'text', text: '2' }],
  }),
);

console.log('Basic MCP server configured with CLG wrapper.');
