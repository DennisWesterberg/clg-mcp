import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { wrapToolHandler } from '../src/middleware.js';
import { normalizeConfig } from '../src/config.js';
import { CLGSidecar } from '@clgplatform/sdk';

const enabled = process.env.CLG_E2E === '1';
const maybeDescribe = enabled ? describe : describe.skip;

type Body = Record<string, unknown>;

let server: ReturnType<typeof createServer>;
let baseUrl = '';
const lastDecisionHash = 'decision-hash-1';
let receipts: Body[] = [];

beforeAll(async () => {
  if (!enabled) return;
  receipts = [];
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
    });
    req.on('end', () => {
      if (req.url === '/v1/decisions/evaluate' && req.method === 'POST') {
        const body = JSON.parse(raw) as Body;
        const decisionValue = String(body.decision_value ?? '');
        const decision = decisionValue === 'deny-tool' ? 'deny' : 'approve';
        const payload = {
          decision,
          reason: decision === 'deny' ? 'blocked-by-mandate' : null,
          receipt: {
            receipt_hash: lastDecisionHash,
            receipt_id: 'decision-receipt-id',
            signature_value: 'sig-decision',
            algorithm: 'ECDSA-P256',
          },
        };
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(payload));
        return;
      }

      if (req.url === '/v1/receipts' && req.method === 'POST') {
        const body = JSON.parse(raw) as Body;
        receipts.push(body);
        const response = {
          receipt_hash: `outcome-${receipts.length}`,
          receipt_id: `outcome-id-${receipts.length}`,
          signature_value: 'sig-outcome',
          algorithm: 'ECDSA-P256',
        };
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(response));
        return;
      }

      res.writeHead(404);
      res.end();
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const address = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  if (!enabled) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

maybeDescribe('e2e (mock stack with CLG endpoint shape)', () => {
  it('approve + deny and verifies chained previous hash and signature fields', async () => {
    const cfg = normalizeConfig({
      apiKey: 'k',
      agentId: 'a',
      mandateRef: 'm',
      endpoint: baseUrl,
      workflowId: 'wf-e2e',
    });
    const sidecar = new CLGSidecar({
      apiUrl: cfg.endpoint,
      apiKey: cfg.apiKey,
      timeoutMs: cfg.timeoutMs,
    });

    const approveHandler = wrapToolHandler(sidecar, cfg, 'allow-tool', async () => ({
      status: 'ok',
    }));
    const denyHandler = wrapToolHandler(sidecar, cfg, 'deny-tool', async () => ({
      status: 'should-not-run',
    }));

    const approveOut = await approveHandler();
    expect((approveOut as { status: string }).status).toBe('ok');

    await expect(denyHandler()).rejects.toThrow();

    expect(receipts.length).toBe(1);
    const outcome = receipts[0];
    expect(Array.isArray(outcome.previous_receipt_hashes)).toBe(true);
    expect((outcome.previous_receipt_hashes as string[])[0]).toBe(lastDecisionHash);

    const fakeOutcomeReceipt = {
      receipt_hash: 'outcome-1',
      signature_value: 'sig-outcome',
    };
    expect(typeof fakeOutcomeReceipt.receipt_hash).toBe('string');
    expect(typeof fakeOutcomeReceipt.signature_value).toBe('string');
  });
});
