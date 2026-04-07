// Copyright (c) 2026 Aistrateg Malmö AB. Licensed under BUSL-1.1.
import { CLGSidecar } from '@clgplatform/sdk';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { normalizeConfig } from './config.js';
import { wrapToolHandler } from './middleware.js';
import type { CLGConfig } from './types.js';

export function withCLG(server: McpServer, config: CLGConfig): McpServer {
  const normalized = normalizeConfig(config);
  const sidecar = new CLGSidecar({
    apiUrl: normalized.endpoint,
    apiKey: normalized.apiKey,
    mode: 'gateway',
    timeoutMs: normalized.timeoutMs,
  });

  const proxy = new Proxy(server, {
    get(target, prop, receiver) {
      if (prop !== 'registerTool') {
        return Reflect.get(target, prop, receiver);
      }

      const original = (
        Reflect.get(target, prop, receiver) as (...args: unknown[]) => RegisteredTool
      ).bind(target);

      return (...args: unknown[]): RegisteredTool => {
        if (args.length < 3 || typeof args[0] !== 'string' || typeof args[2] !== 'function') {
          return original(...args);
        }

        const toolName = args[0];
        const callback = args[2] as (...callbackArgs: unknown[]) => Promise<unknown> | unknown;

        const registered = original(...args);
        const wrapped = wrapToolHandler(sidecar, normalized, toolName, callback);
        registered.update({ callback: wrapped as never });
        return registered;
      };
    },
  });

  return proxy as McpServer;
}
