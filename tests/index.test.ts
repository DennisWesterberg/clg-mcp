import { describe, it, expect, vi, afterEach } from 'vitest';
import { CLGMCPWrapper } from '../src/index.js';

describe('CLGMCPWrapper', () => {
  afterEach(() => vi.restoreAllMocks());

  it('constructs with config', () => {
    const wrapper = new CLGMCPWrapper({
      apiUrl: 'http://localhost:8080',
      apiKey: 'k',
      agentId: 'a',
      workflowId: 'w',
    });
    expect(wrapper).toBeInstanceOf(CLGMCPWrapper);
  });

  it('evaluateTool returns approved on approve', async () => {
    const wrapper = new CLGMCPWrapper({
      apiUrl: 'http://localhost:8080',
      apiKey: 'k',
      agentId: 'a',
      workflowId: 'w',
    });

    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        decision: 'approve',
        reason: null,
        receipt: { receipt_hash: 'h1', decision_outcome: 'approve' },
      }),
    } as any);

    const result = await wrapper.evaluateTool({
      toolName: 'tool:x',
      toolInput: { x: 1 },
    });

    expect(result.approved).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.receipt.receipt_hash).toBe('h1');
  });

  it('evaluateTool returns denied on deny', async () => {
    const wrapper = new CLGMCPWrapper({
      apiUrl: 'http://localhost:8080',
      apiKey: 'k',
      agentId: 'a',
      workflowId: 'w',
    });

    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        decision: 'deny',
        reason: 'blocked',
        receipt: { receipt_hash: 'h2', decision_outcome: 'deny' },
      }),
    } as any);

    const result = await wrapper.evaluateTool({
      toolName: 'tool:y',
      toolInput: { y: 2 },
    });

    expect(result.approved).toBe(false);
    expect(result.reason).toBe('blocked');
  });

  it('guard runs tool when approved', async () => {
    const wrapper = new CLGMCPWrapper({
      apiUrl: 'http://localhost:8080',
      apiKey: 'k',
      agentId: 'a',
      workflowId: 'w',
    });

    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        decision: 'approve',
        reason: null,
        receipt: { receipt_hash: 'h3' },
      }),
    } as any);

    const toolFn = vi.fn().mockResolvedValue({ ok: true });

    const out = await wrapper.guard(
      { toolName: 'tool:z', toolInput: { z: 3 } },
      toolFn
    );

    expect(out.result).toEqual({ ok: true });
    expect(out.receipt.receipt_hash).toBe('h3');
    expect(toolFn).toHaveBeenCalledOnce();
  });

  it('guard throws when denied', async () => {
    const wrapper = new CLGMCPWrapper({
      apiUrl: 'http://localhost:8080',
      apiKey: 'k',
      agentId: 'a',
      workflowId: 'w',
    });

    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        decision: 'deny',
        reason: 'unauthorized',
        receipt: { receipt_hash: 'h4' },
      }),
    } as any);

    const toolFn = vi.fn().mockResolvedValue({ ok: true });

    await expect(
      wrapper.guard({ toolName: 'tool:w', toolInput: { w: 4 } }, toolFn)
    ).rejects.toThrow('denied by CLG');

    expect(toolFn).not.toHaveBeenCalled();
  });

  it('propagates CLG evaluation on guard throw', async () => {
    const wrapper = new CLGMCPWrapper({
      apiUrl: 'http://localhost:8080',
      apiKey: 'k',
      agentId: 'a',
      workflowId: 'w',
    });

    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        decision: 'deny',
        reason: 'rate_limit',
        receipt: { receipt_hash: 'h5' },
      }),
    } as any);

    try {
      await wrapper.guard({ toolName: 'tool:x', toolInput: {} }, async () => 'ok');
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(err.clgEvaluation).toBeDefined();
      expect(err.clgEvaluation.approved).toBe(false);
      expect(err.clgEvaluation.reason).toBe('rate_limit');
    }
  });

  it('honors custom mandateRef', async () => {
    const wrapper = new CLGMCPWrapper({
      apiUrl: 'http://localhost:8080',
      apiKey: 'k',
      agentId: 'a',
      workflowId: 'w',
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        decision: 'approve',
        reason: null,
        receipt: { receipt_hash: 'h6' },
      }),
    } as any);

    await wrapper.evaluateTool({ toolName: 'tool:a', toolInput: {} }, 'custom-mandate');

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
    expect(body.mandate_ref).toBe('custom-mandate');
  });

  it('propagates timeout to sidecar', async () => {
    const wrapper = new CLGMCPWrapper({
      apiUrl: 'http://localhost:8080',
      apiKey: 'k',
      agentId: 'a',
      workflowId: 'w',
      timeoutMs: 100,
    });

    vi.spyOn(globalThis, 'fetch' as any).mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          const signal = init.signal as AbortSignal;
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        })
    );

    await expect(
      wrapper.evaluateTool({ toolName: 'tool:t', toolInput: {} })
    ).rejects.toThrow('timeout after 100ms');
  });

  it('propagates network errors', async () => {
    const wrapper = new CLGMCPWrapper({
      apiUrl: 'http://localhost:8080',
      apiKey: 'k',
      agentId: 'a',
      workflowId: 'w',
    });

    vi.spyOn(globalThis, 'fetch' as any).mockRejectedValue(new Error('network down'));

    await expect(
      wrapper.evaluateTool({ toolName: 'tool:n', toolInput: {} })
    ).rejects.toThrow('network down');
  });

  it('propagates 404 as mandate not found', async () => {
    const wrapper = new CLGMCPWrapper({
      apiUrl: 'http://localhost:8080',
      apiKey: 'k',
      agentId: 'a',
      workflowId: 'w',
    });

    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: false,
      status: 404,
    } as any);

    await expect(
      wrapper.evaluateTool({ toolName: 'tool:x', toolInput: {} }, 'missing-mandate')
    ).rejects.toThrow('CLG API error: 404');
  });

  it('propagates 5xx as server error', async () => {
    const wrapper = new CLGMCPWrapper({
      apiUrl: 'http://localhost:8080',
      apiKey: 'k',
      agentId: 'a',
      workflowId: 'w',
    });

    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: false,
      status: 503,
    } as any);

    await expect(
      wrapper.evaluateTool({ toolName: 'tool:y', toolInput: {} })
    ).rejects.toThrow('CLG API error: 503');
  });

  it('uses default mandateRef when not provided', async () => {
    const wrapper = new CLGMCPWrapper({
      apiUrl: 'http://localhost:8080',
      apiKey: 'k',
      agentId: 'a',
      workflowId: 'w',
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        decision: 'approve',
        reason: null,
        receipt: { receipt_hash: 'h7' },
      }),
    } as any);

    await wrapper.guard(
      { toolName: 'tool:no-mandate', toolInput: {} },
      async () => 'done'
    );

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
    expect(body.mandate_ref).toBe('default');
  });

  it('uses default timeout when not provided', async () => {
    const wrapper = new CLGMCPWrapper({
      apiUrl: 'http://localhost:8080',
      apiKey: 'k',
      agentId: 'a',
      workflowId: 'w',
    });

    expect(wrapper).toBeInstanceOf(CLGMCPWrapper);
  });
});
