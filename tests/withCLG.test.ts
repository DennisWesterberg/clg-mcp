import { describe, expect, it, vi } from 'vitest';
import { withCLG } from '../src/withCLG.js';

class FakeServer {
  public tools = new Map<string, (...args: unknown[]) => unknown>();

  public registerTool(
    name: string,
    _config: unknown,
    cb: (...args: unknown[]) => unknown,
  ): { update: (u: { callback?: (...args: unknown[]) => unknown }) => void } {
    this.tools.set(name, cb);
    return {
      update: ({ callback }) => {
        if (callback) this.tools.set(name, callback);
      },
    };
  }

  public ping(): string {
    return 'pong';
  }
}

describe('withCLG proxy', () => {
  it('passes through non-registerTool methods unchanged', () => {
    const server = new FakeServer();
    const guarded = withCLG(server as never, { apiKey: 'k', agentId: 'a', mandateRef: 'm' }) as unknown as FakeServer;
    expect(guarded.ping()).toBe('pong');
  });

  it('intercepts registerTool called after withCLG', () => {
    const server = new FakeServer();
    const guarded = withCLG(server as never, { apiKey: 'k', agentId: 'a', mandateRef: 'm' }) as unknown as FakeServer;
    guarded.registerTool('echo', {}, vi.fn().mockResolvedValue('ok'));
    expect(server.tools.has('echo')).toBe(true);
  });

  it('returns original registerTool when signature does not match expected callback position', () => {
    const server = new FakeServer();
    const guarded = withCLG(server as never, { apiKey: 'k', agentId: 'a', mandateRef: 'm' }) as unknown as FakeServer;
    // Intentionally invalid shape to exercise fallback path.
    const result = (guarded.registerTool as unknown as (...args: unknown[]) => unknown)('x', {});
    expect(result).toBeDefined();
  });

  it('documents forward-only behavior: tools registered before withCLG are not auto-wrapped', async () => {
    const server = new FakeServer();
    const original = vi.fn().mockResolvedValue('ok');
    server.registerTool('pre', {}, original);

    const guarded = withCLG(server as never, { apiKey: 'k', agentId: 'a', mandateRef: 'm' }) as unknown as FakeServer;
    const pre = server.tools.get('pre');
    expect(pre).toBe(original);

    guarded.registerTool('post', {}, vi.fn().mockResolvedValue('ok'));
    const post = server.tools.get('post');
    expect(post).toBeDefined();
    expect(post).not.toBe(original);
  });
});
