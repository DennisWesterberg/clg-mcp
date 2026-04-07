import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { withCLG } from '../src/withCLG.js';
import { CLGDeniedError, CLGToolExecutionError, CLGUnreachableError } from '../src/errors.js';

const apiUrl = 'https://api.clgplatform.com';
const mswServer = setupServer();

beforeAll(() => mswServer.listen({ onUnhandledRequest: 'error' }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

describe('integration (real McpServer + msw)', () => {
  it('approve end-to-end', async () => {
    mswServer.use(
      http.post(`${apiUrl}/v1/decisions/evaluate`, () =>
        HttpResponse.json({ decision: 'approve', reason: null, receipt: { receipt_hash: 'h1' } }),
      ),
      http.post(`${apiUrl}/v1/receipts`, () => HttpResponse.json({ receipt_hash: 'h2' })),
    );

    const server = withCLG(new McpServer({ name: 'x', version: '1.0.0' }), {
      apiKey: 'k',
      agentId: 'a',
      mandateRef: 'm',
      workflowId: 'wf',
    });

    const tool = server.registerTool('echo', { description: 'Echo' }, async () => ({
      content: [{ type: 'text', text: 'ok' }],
    }));

    const result = await (tool.handler as (extra: unknown) => Promise<unknown>)({});
    expect((result as { content: Array<{ text: string }> }).content[0].text).toBe('ok');
  });

  it('deny end-to-end', async () => {
    mswServer.use(
      http.post(`${apiUrl}/v1/decisions/evaluate`, () =>
        HttpResponse.json({ decision: 'deny', reason: 'blocked', receipt: { receipt_id: 'r1' } }),
      ),
    );

    const server = withCLG(new McpServer({ name: 'x', version: '1.0.0' }), {
      apiKey: 'k',
      agentId: 'a',
      mandateRef: 'm',
    });

    const tool = server.registerTool('blocked-tool', { description: 'Blocked' }, async () => ({
      content: [{ type: 'text', text: 'nope' }],
    }));

    await expect(
      (tool.handler as (extra: unknown) => Promise<unknown>)({}),
    ).rejects.toBeInstanceOf(CLGDeniedError);
  });

  it('timeout/unreachable closed end-to-end', async () => {
    mswServer.use(http.post(`${apiUrl}/v1/decisions/evaluate`, () => HttpResponse.error()));

    const server = withCLG(new McpServer({ name: 'x', version: '1.0.0' }), {
      apiKey: 'k',
      agentId: 'a',
      mandateRef: 'm',
      failureMode: 'closed',
    });

    const tool = server.registerTool('closed-tool', { description: 'Closed' }, async () => ({
      content: [{ type: 'text', text: 'ok' }],
    }));

    await expect(
      (tool.handler as (extra: unknown) => Promise<unknown>)({}),
    ).rejects.toBeInstanceOf(CLGUnreachableError);
  });

  it('tool crash end-to-end', async () => {
    mswServer.use(
      http.post(`${apiUrl}/v1/decisions/evaluate`, () =>
        HttpResponse.json({ decision: 'approve', reason: null, receipt: { receipt_hash: 'h1' } }),
      ),
      http.post(`${apiUrl}/v1/receipts`, () => HttpResponse.json({ receipt_hash: 'h2' })),
    );

    const server = withCLG(new McpServer({ name: 'x', version: '1.0.0' }), {
      apiKey: 'k',
      agentId: 'a',
      mandateRef: 'm',
      workflowId: 'wf',
    });

    const tool = server.registerTool('crash', { description: 'Crash' }, async () => {
      throw new Error('boom');
    });

    await expect(
      (tool.handler as (extra: unknown) => Promise<unknown>)({}),
    ).rejects.toBeInstanceOf(CLGToolExecutionError);
  });
});
