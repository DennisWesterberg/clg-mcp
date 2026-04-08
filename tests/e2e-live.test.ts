/**
 * Live E2E test — runs against a real local clg-platform instance.
 *
 * Prerequisites:
 *   1. clg-platform running on localhost:8080 with a PostgreSQL database
 *   2. Set env: CLG_E2E_LIVE=1
 *
 * The test creates its own org, API key, agent, workflow, and mandate,
 * then exercises the full MCP wrapper flow against the real API.
 *
 * Run:
 *   CLG_E2E_LIVE=1 npx vitest run tests/e2e-live.test.ts
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { wrapToolHandler } from '../src/middleware.js';
import { normalizeConfig } from '../src/config.js';
import { CLGSidecar } from '@clgplatform/sdk';

const enabled = process.env.CLG_E2E_LIVE === '1';
const maybeDescribe = enabled ? describe : describe.skip;

const BASE = process.env.CLG_E2E_URL || 'http://localhost:8080';
const TEST_EMAIL = `e2e-${Date.now()}@test.local`;
const TEST_PASSWORD = 'e2ePassword!42';
const TEST_ORG_NAME = `e2e-org-${Date.now()}`;

let apiKey = '';
let sessionToken = '';

async function api(method: string, path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

beforeAll(async () => {
  if (!enabled) return;

  // 1. Register org
  await api('POST', '/v1/auth/register', {
    name: TEST_ORG_NAME,
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  // 2. Login
  const login = await api('POST', '/v1/auth/login', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  sessionToken = login.token;

  // 3. Create API key
  const keyResult = await api('POST', '/v1/api-keys', { label: 'e2e-test' }, sessionToken);
  apiKey = keyResult.key;

  // 4. Create agent
  await api(
    'POST',
    '/v1/agents',
    { external_agent_id: 'e2e-agent', name: 'E2E Test Agent' },
    apiKey,
  );

  // 5. Create workflow
  await api(
    'POST',
    '/v1/workflows',
    { external_workflow_id: 'e2e-workflow', name: 'E2E Workflow' },
    apiKey,
  );

  // 6. Create a permissive mandate (default should already exist, but ensure one with our ref)
  await api(
    'POST',
    '/v1/mandates',
    {
      ref: 'e2e-mandate',
      definition: {
        allowedDecisionTypes: ['tool-call'],
        description: 'Permissive e2e mandate',
      },
    },
    sessionToken,
  );
}, 30_000);

maybeDescribe('e2e-live: full MCP wrapper against real clg-platform', () => {
  it('approved tool call creates decision + outcome receipts', async () => {
    const cfg = normalizeConfig({
      apiKey,
      agentId: 'e2e-agent',
      mandateRef: 'e2e-mandate',
      endpoint: BASE,
      workflowId: 'e2e-workflow',
    });
    const sidecar = new CLGSidecar({
      apiUrl: cfg.endpoint,
      apiKey: cfg.apiKey,
      timeoutMs: cfg.timeoutMs,
    });

    const handler = wrapToolHandler(sidecar, cfg, 'calculator', async (input: unknown) => ({
      result: 42,
      input,
    }));

    const result = await handler({ a: 1, b: 2 });
    expect((result as any).result).toBe(42);

    // Verify receipts were created
    const receipts = await api('GET', '/v1/receipts?workflow_id=e2e-workflow&limit=10', undefined, apiKey);
    expect(receipts.data.length).toBeGreaterThanOrEqual(2); // decision + outcome
    expect(receipts.data.some((r: any) => r.decision_type === 'tool-call')).toBe(true);
    expect(receipts.data.some((r: any) => r.decision_type === 'tool-outcome')).toBe(true);

    // Verify chain linkage: outcome should reference decision hash
    const outcome = receipts.data.find((r: any) => r.decision_type === 'tool-outcome');
    const decision = receipts.data.find((r: any) => r.decision_type === 'tool-call');
    if (outcome && decision) {
      expect(outcome.previous_receipt_hashes).toContain(decision.receipt_hash);
    }
  });

  it('chain verification passes for the workflow', async () => {
    const verify = await api(
      'POST',
      '/v1/verify/chain/e2e-workflow',
      {},
      apiKey,
    );
    // Should succeed (chain is valid)
    expect(verify).toBeDefined();
  });
});
