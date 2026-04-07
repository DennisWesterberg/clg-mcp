// Copyright (c) 2026 Aistrateg Malmö AB. Licensed under BUSL-1.1.
import { CLGConfigError } from './errors.js';
import type { CLGConfig, NormalizedCLGConfig } from './types.js';

const DEFAULT_ENDPOINT = 'https://api.clgplatform.com';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

export function normalizeConfig(config: CLGConfig): NormalizedCLGConfig {
  const issues: string[] = [];

  if (!isNonEmptyString(config.apiKey)) issues.push('apiKey must be a non-empty string');
  if (!isNonEmptyString(config.agentId)) issues.push('agentId must be a non-empty string');
  if (!isNonEmptyString(config.mandateRef)) issues.push('mandateRef must be a non-empty string');

  if (config.endpoint !== undefined) {
    try {
      new URL(config.endpoint);
    } catch {
      issues.push('endpoint must be a valid URL when provided');
    }
  }

  if (
    config.failureMode !== undefined &&
    config.failureMode !== 'closed' &&
    config.failureMode !== 'open'
  ) {
    issues.push("failureMode must be either 'closed' or 'open'");
  }

  if (
    config.timeoutMs !== undefined &&
    (!Number.isInteger(config.timeoutMs) || config.timeoutMs <= 0)
  ) {
    issues.push('timeoutMs must be a positive integer when provided');
  }

  const callbackEntries: Array<[name: string, value: unknown]> = [
    ['redact', config.redact],
    ['beforeSend', config.beforeSend],
    ['onDecision', config.onDecision],
    ['onOutcome', config.onOutcome],
    ['onError', config.onError],
  ];

  for (const [name, value] of callbackEntries) {
    if (value !== undefined && !isFunction(value)) {
      issues.push(`${name} must be a function when provided`);
    }
  }

  if (issues.length > 0) {
    throw new CLGConfigError('Invalid CLG config', issues);
  }

  return {
    apiKey: config.apiKey,
    agentId: config.agentId,
    mandateRef: config.mandateRef,
    workflowId: config.workflowId ?? `${config.agentId}-${Date.now()}`,
    endpoint: config.endpoint ?? DEFAULT_ENDPOINT,
    failureMode: config.failureMode ?? 'closed',
    timeoutMs: config.timeoutMs ?? 5000,
    redact: config.redact,
    beforeSend: config.beforeSend,
    onDecision: config.onDecision,
    onOutcome: config.onOutcome,
    onError: config.onError,
  };
}
