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
        return responseOf({
          ok: true,
          status: 200,
          body: { decision: 'approve', reason: null, receipt: { receipt_hash: 'h1' } },
        });
      }
      return responseOf({ ok: true, status: 200, body: { receipt_hash: 'h2' } });
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

  it('approve success + receipt submission fails returns tool result and reports onError', async () => {
    const errors: unknown[] = [];
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        responseOf({ ok: true, status: 200, body: { decision: 'approve', reason: null, receipt: { receipt_hash: 'h1' } } }),
      )
      .mockRejectedValueOnce(new Error('receipt network failure'));

    const cfg = normalizeConfig({
      apiKey: 'k',
      agentId: 'a',
      mandateRef: 'm',
      onError: (err) => errors.push(err),
    });
    const sidecar = new CLGSidecar({ apiUrl: cfg.endpoint, apiKey: cfg.apiKey, timeoutMs: cfg.timeoutMs });
    const handler = wrapToolHandler(sidecar, cfg, 'echo', async () => ({ final: 'value' }));

    await expect(handler()).resolves.toEqual({ final: 'value' });
    expect(errors).toHaveLength(1);
    const err = errors[0] as CLGUnreachableError;
    expect(err).toBeInstanceOf(CLGUnreachableError);
    expect(err.message).toContain('Outcome receipt submission failed after successful tool execution');
  });

  it('approve -> tool crash -> failure receipt and CLGToolExecutionError', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/v1/decisions/evaluate')) {
        return responseOf({
          ok: true,
          status: 200,
          body: { decision: 'approve', reason: null, receipt: { receipt_hash: 'h1' } },
        });
      }
      return responseOf({ ok: true, status: 200, body: { receipt_hash: 'h2' } });
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

  it('approve tool crash + failure receipt submission fails rethrows original tool cause', async () => {
    const errors: unknown[] = [];
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        responseOf({ ok: true, status: 200, body: { decision: 'approve', reason: null, receipt: { receipt_hash: 'h1' } } }),
      )
      .mockRejectedValueOnce(new Error('receipt failure'));

    const cfg = normalizeConfig({
      apiKey: 'k',
      agentId: 'a',
      mandateRef: 'm',
      onError: (err) => errors.push(err),
    });
    const sidecar = new CLGSidecar({ apiUrl: cfg.endpoint, apiKey: cfg.apiKey, timeoutMs: cfg.timeoutMs });
    const handler = wrapToolHandler(sidecar, cfg, 'explode', async () => {
      throw new Error('primary tool crash');
    });

    try {
      await handler();
      expect.fail('expected error');
    } catch (error) {
      const wrapped = error as CLGToolExecutionError;
      expect(wrapped).toBeInstanceOf(CLGToolExecutionError);
      expect((wrapped.cause as Error).message).toBe('primary tool crash');
    }

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(CLGUnreachableError);
    expect((errors[0] as Error).message).toContain('Failure outcome receipt submission failed after tool crash');
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

    const payload = JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body)) as Record<string, unknown>;
    expect(payload.decision_type).toBe('tool-outcome-unverified');
  });

  it('fail-open success path redacts output before unverified receipt', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(responseOf({ ok: true, status: 200, body: { receipt_hash: 'u1' } }));

    const cfg = normalizeConfig({
      apiKey: 'k',
      agentId: 'a',
      mandateRef: 'm',
      failureMode: 'open',
      redact: (value) => {
        if (value && typeof value === 'object') {
          const v = value as Record<string, unknown>;
          if ('secret' in v) return { ...v, secret: '[REDACTED]' };
        }
        return value;
      },
    });
    const sidecar = new CLGSidecar({ apiUrl: cfg.endpoint, apiKey: cfg.apiKey, timeoutMs: cfg.timeoutMs });
    const handler = wrapToolHandler(sidecar, cfg, 'echo', async () => ({ secret: 'raw', ok: true }));

    await expect(handler()).resolves.toEqual({ secret: 'raw', ok: true });
    const payload = JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body)) as Record<string, unknown>;
    expect((payload.output as Record<string, unknown>).secret).toBe('[REDACTED]');
  });

  it('fail-open failure path redacts error output', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(responseOf({ ok: true, status: 200, body: { receipt_hash: 'u1' } }));

    const cfg = normalizeConfig({
      apiKey: 'k',
      agentId: 'a',
      mandateRef: 'm',
      failureMode: 'open',
      redact: (value) => {
        if (value && typeof value === 'object') {
          const v = value as Record<string, unknown>;
          if ('error_message' in v) return { ...v, error_message: '[REDACTED]' };
        }
        return value;
      },
    });
    const sidecar = new CLGSidecar({ apiUrl: cfg.endpoint, apiKey: cfg.apiKey, timeoutMs: cfg.timeoutMs });
    const handler = wrapToolHandler(sidecar, cfg, 'echo', async () => {
      throw new Error('secret-failure');
    });

    await expect(handler()).rejects.toThrow('secret-failure');
    const payload = JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body)) as Record<string, unknown>;
    expect((payload.output as Record<string, unknown>).error_message).toBe('[REDACTED]');
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
        return responseOf({
          ok: true,
          status: 200,
          body: { decision: 'approve', reason: null, receipt: { receipt_hash: 'h1' } },
        });
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
        return responseOf({
          ok: true,
          status: 200,
          body: { decision: 'approve', reason: null, receipt: { receipt_hash: 'h1' } },
        });
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
    const handler = wrapToolHandler(sidecar, cfg, 'echo', async (_args: { secret: string }) => ({ ok: true }));

    const out = await handler({ secret: 'raw' });
    expect(out).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(calls.indexOf('redact')).toBeLessThan(calls.indexOf('beforeSend'));
    expect(calls).toContain('onDecision');
    expect(calls).toContain('onOutcome');
  });
});
