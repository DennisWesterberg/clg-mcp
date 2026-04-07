import { describe, expect, it } from 'vitest';
import {
  CLGConfigError,
  CLGDeniedError,
  CLGError,
  CLGToolExecutionError,
  CLGUnreachableError,
} from '../src/errors.js';

describe('errors', () => {
  it('base error keeps name and cause', () => {
    const root = new Error('root');
    const err = new CLGError('top', root);
    expect(err.name).toBe('CLGError');
    expect(err.cause).toBe(root);
    expect(err).toBeInstanceOf(Error);
  });

  it('CLGDeniedError structure and hierarchy', () => {
    const err = new CLGDeniedError('denied', 'r1', 'blocked');
    expect(err).toBeInstanceOf(CLGDeniedError);
    expect(err).toBeInstanceOf(CLGError);
    expect(err.name).toBe('CLGDeniedError');
    expect(err.receiptId).toBe('r1');
    expect(err.reason).toBe('blocked');
  });

  it('CLGUnreachableError structure', () => {
    const cause = new Error('timeout');
    const err = new CLGUnreachableError('unreachable', cause);
    expect(err.name).toBe('CLGUnreachableError');
    expect(err).toBeInstanceOf(CLGError);
    expect(err.cause).toBe(cause);
  });

  it('CLGToolExecutionError structure', () => {
    const err = new CLGToolExecutionError('boom', 'calculator', new Error('inner'));
    expect(err.name).toBe('CLGToolExecutionError');
    expect(err.toolName).toBe('calculator');
    expect(err).toBeInstanceOf(CLGError);
  });

  it('CLGConfigError structure', () => {
    const err = new CLGConfigError('invalid', ['a', 'b']);
    expect(err.name).toBe('CLGConfigError');
    expect(err.issues).toEqual(['a', 'b']);
    expect(err).toBeInstanceOf(CLGError);
  });

  it('toJSON is usable and stable', () => {
    const err = new CLGToolExecutionError('boom', 'calc', new Error('cause'));
    const serialized = JSON.parse(JSON.stringify(err)) as Record<string, unknown>;
    expect(serialized.name).toBe('CLGToolExecutionError');
    expect(serialized.toolName).toBe('calc');
    expect(typeof serialized.message).toBe('string');
  });

  it('CLGDeniedError toJSON includes receiptId and reason', () => {
    const err = new CLGDeniedError('denied', null, null);
    const serialized = JSON.parse(JSON.stringify(err)) as Record<string, unknown>;
    expect(serialized.receiptId).toBeNull();
    expect(serialized.reason).toBeNull();
  });

  it('CLGConfigError toJSON includes issues', () => {
    const err = new CLGConfigError('invalid', ['missing apiKey']);
    const serialized = JSON.parse(JSON.stringify(err)) as Record<string, unknown>;
    expect(serialized.issues).toEqual(['missing apiKey']);
  });
});
