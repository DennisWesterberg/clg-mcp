import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const server = new McpServer({ name: 'before', version: '1.0.0' });

server.registerTool('echo', { description: 'Echo' }, async () => ({
  content: [{ type: 'text', text: 'ok' }],
}));
