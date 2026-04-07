import { describe, expect, it } from 'vitest';
import { redactPaths } from '../src/index.js';

describe('index exports', () => {
  it('exports redactPaths', () => {
    const fn = redactPaths(['a.b']);
    expect(typeof fn).toBe('function');
  });
});
