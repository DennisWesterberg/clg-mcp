import { describe, expect, it } from 'vitest';
import { normalizeConfig } from '../src/config.js';
import { CLGConfigError } from '../src/errors.js';

describe('normalizeConfig', () => {
  it('applies defaults', () => {
    const out = normalizeConfig({ apiKey: 'k', agentId: 'a', mandateRef: 'm' });
    expect(out.endpoint).toBe('https://api.clgplatform.com');
    expect(out.failureMode).toBe('closed');
    expect(out.timeoutMs).toBe(5000);
    expect(out.workflowId.startsWith('a-')).toBe(true);
  });

  it('keeps provided optional values', () => {
    const redact = (x: unknown) => x;
    const beforeSend = (x: {
      workflow_id: string;
      task_id: string;
      agent_id: string;
      mandate_ref: string;
      decision_type: string;
      decision_value: string;
      task_input: unknown;
      timestamp: string;
      previous_receipt_hashes?: string[];
    }) => x;
    const out = normalizeConfig({
      apiKey: 'k',
      agentId: 'a',
      mandateRef: 'm',
      endpoint: 'https://example.com',
      failureMode: 'open',
      timeoutMs: 1000,
      workflowId: 'wf-1',
      redact,
      beforeSend,
      onDecision: () => undefined,
      onOutcome: () => undefined,
      onError: () => undefined,
    });

    expect(out.endpoint).toBe('https://example.com');
    expect(out.failureMode).toBe('open');
    expect(out.timeoutMs).toBe(1000);
    expect(out.workflowId).toBe('wf-1');
    expect(out.redact).toBe(redact);
    expect(out.beforeSend).toBe(beforeSend);
  });

  it('throws with issues for required fields and malformed values', () => {
    expect(() =>
      normalizeConfig({
        apiKey: '',
        agentId: '',
        mandateRef: '',
        endpoint: 'bad-url',
        failureMode: 'x' as never,
        timeoutMs: -1,
      }),
    ).toThrow(CLGConfigError);

    try {
      normalizeConfig({
        apiKey: '',
        agentId: '',
        mandateRef: '',
        endpoint: 'bad-url',
        failureMode: 'x' as never,
        timeoutMs: -1,
      });
      expect.fail('should throw');
    } catch (error) {
      const cfgError = error as CLGConfigError;
      expect(cfgError.issues.length).toBeGreaterThanOrEqual(6);
      expect(cfgError.issues.join(' | ')).toContain('apiKey must be a non-empty string');
      expect(cfgError.issues.join(' | ')).toContain('endpoint must be a valid URL when provided');
    }
  });

  it('rejects non-function callbacks', () => {
    expect(() => normalizeConfig({ apiKey: 'k', agentId: 'a', mandateRef: 'm', onError: 1 as never })).toThrow(
      CLGConfigError,
    );
    expect(() =>
      normalizeConfig({ apiKey: 'k', agentId: 'a', mandateRef: 'm', beforeSend: 'x' as never }),
    ).toThrow(CLGConfigError);
  });

  it('rejects non-positive or non-integer timeout', () => {
    expect(() => normalizeConfig({ apiKey: 'k', agentId: 'a', mandateRef: 'm', timeoutMs: 0 })).toThrow(
      CLGConfigError,
    );
    expect(() => normalizeConfig({ apiKey: 'k', agentId: 'a', mandateRef: 'm', timeoutMs: 1.2 })).toThrow(
      CLGConfigError,
    );
  });
});
