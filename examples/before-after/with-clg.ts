import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withCLG } from '@clgplatform/mcp';

const server = withCLG(new McpServer({ name: 'after', version: '1.0.0' }), {
  apiKey: process.env.CLG_API_KEY ?? 'replace-me',
  agentId: 'after-agent',
  mandateRef: 'mandates/default',
});

server.registerTool('echo', { description: 'Echo' }, async () => ({
  content: [{ type: 'text', text: 'ok' }],
}));
