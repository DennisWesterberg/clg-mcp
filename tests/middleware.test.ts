import { CLGSidecar } from '@clgplatform/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeConfig } from '../src/config.js';
import { CLGDeniedError, CLGToolExecutionError, CLGUnreachableError } from '../src/errors.js';
import { wrapToolHandler } from '../src/middleware.js';

type JsonResponse = { ok: boolean; status: number; body: unknown };

function responseOf(value: JsonResponse): Response {
  return {
    ok: value.ok,
    status: value.status,
    json: async () => value.body,
  } as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('wrapToolHandler (real SDK, HTTP mocked)', () => {
  it('approve -> successful tool -> chained outcome receipt', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/v1/decisions/evaluate')) {
        return responseOf({ ok: true, status: 200, body: { decision: 'approve', reason: null, receipt: { receipt_hash: 'h1' } } });
      }
      if (url.endsWith('/v1/receipts')) {
        return responseOf({ ok: true, status: 200, body: { receipt_hash: 'h2' } });
      }
      return responseOf({ ok: false, status: 404, body: {} });
    });

    const cfg = normalizeConfig({ apiKey: 'k', agentId: 'a', mandateRef: 'm', workflowId: 'wf' });
    const sidecar = new CLGSidecar({ apiUrl: cfg.endpoint, apiKey: cfg.apiKey, timeoutMs: cfg.timeoutMs });

    const handler = wrapToolHandler(sidecar, cfg, 'echo', async (args: { value: number }) => ({ ok: args.value + 1 }));
    const out = await handler({ value: 1 });

    expect(out).toEqual({ ok: 2 });
    const receiptPayload = JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body)) as Record<string, unknown>;
    expect(receiptPayload.decision_type).toBe('tool-outcome');
    expect(receiptPayload.previous_receipt_hashes).toEqual(['h1']);
  });

  it('approve -> tool crash -> failure receipt and CLGToolExecutionError', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/v1/decisions/evaluate')) {
        return responseOf({ ok: true, status: 200, body: { decision: 'approve', reason: null, receipt: { receipt_hash: 'h1' } } });
      }
      if (url.endsWith('/v1/receipts')) {
        return responseOf({ ok: true, status: 200, body: { receipt_hash: 'h2' } });
      }
      return responseOf({ ok: false, status: 500, body: {} });
    });

    const cfg = normalizeConfig({ apiKey: 'k', agentId: 'a', mandateRef: 'm' });
    const sidecar = new CLGSidecar({ apiUrl: cfg.endpoint, apiKey: cfg.apiKey, timeoutMs: cfg.timeoutMs });
    const handler = wrapToolHandler(sidecar, cfg, 'explode', async () => {
      throw new Error('boom');
    });

    await expect(handler()).rejects.toBeInstanceOf(CLGToolExecutionError);
    const payload = JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body)) as Record<string, unknown>;
    expect(payload.decision_type).toBe('tool-outcome-failed');
    expect((payload.output as Record<string, unknown>).status).toBe('failed');
  });

  it('deny -> tool not executed -> CLGDeniedError', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/v1/decisions/evaluate')) {
        return responseOf({ ok: true, status: 200, body: { decision: 'deny', reason: 'blocked', receipt: { receipt_id: 'r1' } } });
      }
      return responseOf({ ok: true, status: 200, body: {} });
    });

    const cfg = normalizeConfig({ apiKey: 'k', agentId: 'a', mandateRef: 'm' });
    const sidecar = new CLGSidecar({ apiUrl: cfg.endpoint, apiKey: cfg.apiKey, timeoutMs: cfg.timeoutMs });
    const tool = vi.fn().mockResolvedValue('ok');

    const handler = wrapToolHandler(sidecar, cfg, 'deny-me', tool);
    await expect(handler()).rejects.toBeInstanceOf(CLGDeniedError);
    expect(tool).not.toHaveBeenCalled();
  });

  it('closed mode on CLG error blocks tool', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

    const cfg = normalizeConfig({ apiKey: 'k', agentId: 'a', mandateRef: 'm', failureMode: 'closed' });
    const sidecar = new CLGSidecar({ apiUrl: cfg.endpoint, apiKey: cfg.apiKey, timeoutMs: cfg.timeoutMs });

    const tool = vi.fn().mockResolvedValue('ok');
    const handler = wrapToolHandler(sidecar, cfg, 'echo', tool);

    await expect(handler()).rejects.toBeInstanceOf(CLGUnreachableError);
    expect(tool).not.toHaveBeenCalled();
  });

  it('open mode on CLG error runs tool and submits unverified outcome', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(responseOf({ ok: true, status: 200, body: { receipt_hash: 'u1' } }));

    const cfg = normalizeConfig({ apiKey: 'k', agentId: 'a', mandateRef: 'm', failureMode: 'open' });
    const sidecar = new CLGSidecar({ apiUrl: cfg.endpoint, apiKey: cfg.apiKey, timeoutMs: cfg.timeoutMs });
    const tool = vi.fn().mockResolvedValue({ ok: true });

    const handler = wrapToolHandler(sidecar, cfg, 'echo', tool);
    await expect(handler()).resolves.toEqual({ ok: true });

    expect(tool).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body)) as Record<string, unknown>;
    expect(payload.decision_type).toBe('tool-outcome-unverified');
  });

  it('open mode preserves original tool error when tool fails after CLG failure', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(responseOf({ ok: true, status: 200, body: { receipt_hash: 'u1' } }));

    const cfg = normalizeConfig({ apiKey: 'k', agentId: 'a', mandateRef: 'm', failureMode: 'open' });
    const sidecar = new CLGSidecar({ apiUrl: cfg.endpoint, apiKey: cfg.apiKey, timeoutMs: cfg.timeoutMs });
    const handler = wrapToolHandler(sidecar, cfg, 'echo', async () => {
      throw new Error('tool-failed');
    });

    await expect(handler()).rejects.toThrow('tool-failed');
  });

  it('open mode tool failure + unverified receipt failure still throws original tool error', async () => {
    const errors: Error[] = [];
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('network down'))
      .mockRejectedValueOnce(new Error('receipt down'));

    const cfg = normalizeConfig({
      apiKey: 'k',
      agentId: 'a',
      mandateRef: 'm',
      failureMode: 'open',
      onError: (err) => errors.push(err),
    });
    const sidecar = new CLGSidecar({ apiUrl: cfg.endpoint, apiKey: cfg.apiKey, timeoutMs: cfg.timeoutMs });
    const handler = wrapToolHandler(sidecar, cfg, 'echo', async () => {
      throw new Error('tool-failed-hard');
    });

    await expect(handler()).rejects.toThrow('tool-failed-hard');
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('open mode swallows unverified receipt failure but reports onError', async () => {
    const errors: Error[] = [];
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('network down'))
      .mockRejectedValueOnce(new Error('receipt down'));

    const cfg = normalizeConfig({
      apiKey: 'k',
      agentId: 'a',
      mandateRef: 'm',
      failureMode: 'open',
      onError: (err) => errors.push(err),
    });
    const sidecar = new CLGSidecar({ apiUrl: cfg.endpoint, apiKey: cfg.apiKey, timeoutMs: cfg.timeoutMs });
    const handler = wrapToolHandler(sidecar, cfg, 'echo', async () => ({ ok: true }));

    await expect(handler()).resolves.toEqual({ ok: true });
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('deny without receipt_id yields null receiptId', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/v1/decisions/evaluate')) {
        return responseOf({ ok: true, status: 200, body: { decision: 'deny', reason: null, receipt: {} } });
      }
      return responseOf({ ok: true, status: 200, body: {} });
    });

    const cfg = normalizeConfig({ apiKey: 'k', agentId: 'a', mandateRef: 'm' });
    const sidecar = new CLGSidecar({ apiUrl: cfg.endpoint, apiKey: cfg.apiKey, timeoutMs: cfg.timeoutMs });
    const handler = wrapToolHandler(sidecar, cfg, 'deny-no-id', async () => ({ ok: true }));

    try {
      await handler();
      expect.fail('expected deny');
    } catch (error) {
      expect((error as CLGDeniedError).receiptId).toBeNull();
    }
  });

  it('approve tool throws non-Error value and failure receipt still emits', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/v1/decisions/evaluate')) {
        return responseOf({ ok: true, status: 200, body: { decision: 'approve', reason: null, receipt: { receipt_hash: 'h1' } } });
      }
      return responseOf({ ok: true, status: 200, body: { receipt_hash: 'h2' } });
    });

    const cfg = normalizeConfig({ apiKey: 'k', agentId: 'a', mandateRef: 'm' });
    const sidecar = new CLGSidecar({ apiUrl: cfg.endpoint, apiKey: cfg.apiKey, timeoutMs: cfg.timeoutMs });
    const handler = wrapToolHandler(sidecar, cfg, 'throw-string', async () => {
      throw 'non-error';
    });

    await expect(handler()).rejects.toBeInstanceOf(CLGToolExecutionError);
    const payload = JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body)) as Record<string, unknown>;
    const output = payload.output as Record<string, unknown>;
    expect(output.error_name).toBe('Error');
    expect(output.error_message).toBe('non-error');
  });

  it('approve flow without decision receipt hash still executes outcome receipt', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/v1/decisions/evaluate')) {
        return responseOf({ ok: true, status: 200, body: { decision: 'approve', reason: null, receipt: {} } });
      }
      return responseOf({ ok: true, status: 200, body: { receipt_hash: 'h2' } });
    });

    const cfg = normalizeConfig({ apiKey: 'k', agentId: 'a', mandateRef: 'm' });
    const sidecar = new CLGSidecar({ apiUrl: cfg.endpoint, apiKey: cfg.apiKey, timeoutMs: cfg.timeoutMs });
    const handler = wrapToolHandler(sidecar, cfg, 'echo', async () => ({ ok: true }));

    await expect(handler()).resolves.toEqual({ ok: true });
    const payload = JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body)) as Record<string, unknown>;
    expect(payload.previous_receipt_hashes).toBeUndefined();
  });

  it('redact runs before beforeSend and callbacks fire', async () => {
    const calls: string[] = [];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/v1/decisions/evaluate')) {
        const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
        const taskInput = payload.task_input as Record<string, unknown>;
        expect(taskInput.secret).toBe('[REDACTED]');
        expect(payload.decision_value).toBe('echo');
        return responseOf({ ok: true, status: 200, body: { decision: 'approve', reason: null, receipt: { receipt_hash: 'h1' } } });
      }
      return responseOf({ ok: true, status: 200, body: { receipt_hash: 'h2' } });
    });

    const cfg = normalizeConfig({
      apiKey: 'k',
      agentId: 'a',
      mandateRef: 'm',
      redact: (value: unknown) => {
        calls.push('redact');
        const v = value as Record<string, unknown>;
        return { ...v, secret: '[REDACTED]' };
      },
      beforeSend: (env) => {
        calls.push('beforeSend');
        return { ...env, decision_value: 'echo' };
      },
      onDecision: () => calls.push('onDecision'),
      onOutcome: () => calls.push('onOutcome'),
      onError: () => calls.push('onError'),
    });

    const sidecar = new CLGSidecar({ apiUrl: cfg.endpoint, apiKey: cfg.apiKey, timeoutMs: cfg.timeoutMs });
    const handler = wrapToolHandler(sidecar, cfg, 'echo', async () => ({ ok: true }));

    const out = await handler();
    expect(out).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(calls).toContain('redact');
    expect(calls).toContain('beforeSend');
    expect(calls).toContain('onDecision');
    expect(calls).toContain('onOutcome');
    expect(calls).not.toContain('onError');
    expect(calls.indexOf('redact')).toBeLessThan(calls.indexOf('beforeSend'));
  });
});
